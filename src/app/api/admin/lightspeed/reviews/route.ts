import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdminApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadLightspeedFamily,
  SupabaseCatalogReconciliationStore,
} from "@/modules/lightspeed/server";
import {
  describeLightspeedFamily,
  familyCorrectionsSchema,
  normalizeLightspeedFamily,
  safeError,
  type ReconciliationSummary,
} from "@/modules/lightspeed/reconciliation";
import type { Json } from "@/types/db/database.types";
import { logError } from "@/lib/utils/log";

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function context() {
  const session = await requireAdminApi();
  const tenantId = session.profile?.tenant_id;
  if (!tenantId) throw new Error("Admin tenant is required");
  return { session, tenantId, db: await createSupabaseServerClient() };
}
function failure(error: unknown) {
  if (error instanceof SyntaxError) return reply({ error: "Invalid JSON body" }, 400);
  if (error instanceof AuthError) return reply({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return reply({ error: "Check the submitted fields", issues: error.issues }, 400);
  if (
    error instanceof Error &&
    error.message === "lightspeed_reconciliation_already_running"
  )
    return reply(
      { error: "A sync or retry is already running. Try again when it finishes." },
      409,
    );
  logError(error, { layer: "api", endpoint: "/api/admin/lightspeed/reviews" });
  return reply({ error: "Could not load or save the review. Please retry." }, 500);
}

export async function GET(request: Request) {
  try {
    const { tenantId, db } = await context();
    const params = new URL(request.url).searchParams;
    const familyId = params.get("familyId");
    if (!familyId) {
      const page = z.coerce
        .number()
        .int()
        .min(0)
        .parse(params.get("page") ?? 0);
      const result = await db
        .from("lightspeed_import_reviews")
        .select("family_id,error,source_payload", { count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("resolved", false)
        .order("family_id")
        .range(page * 20, page * 20 + 19);
      if (result.error) throw result.error;
      const items = await Promise.all(
        (result.data ?? []).map(async (row) => {
          let payload = row.source_payload;
          if (!payload) {
            try {
              payload = (await loadLightspeedFamily(row.family_id, false)) as Json;
              const saved = await db
                .from("lightspeed_import_reviews")
                .update({ source_payload: payload })
                .eq("tenant_id", tenantId)
                .eq("family_id", row.family_id);
              if (saved.error) throw saved.error;
            } catch {
              /* Individual provider failures must not hide the rest of the queue. */
            }
          }
          const parsed = z
            .object({ data: z.object({ name: z.string() }) })
            .safeParse(payload);
          return {
            id: row.family_id,
            name: parsed.success ? parsed.data.data.name : row.family_id,
            error: row.error,
          };
        }),
      );
      return reply({ total: result.count ?? 0, items });
    }
    z.string().uuid().parse(familyId);
    const result = await db
      .from("lightspeed_import_reviews")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("family_id", familyId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return reply({ error: "Review not found" }, 404);
    const raw = await loadLightspeedFamily(familyId);
    const saved = await db
      .from("lightspeed_import_reviews")
      .update({ source_payload: raw as Json })
      .eq("tenant_id", tenantId)
      .eq("family_id", familyId);
    if (saved.error) throw saved.error;
    return reply({
      family: describeLightspeedFamily(
        raw,
        familyCorrectionsSchema.parse(result.data.corrections),
      ),
      error: result.data.error,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId, db, session } = await context();
    const { familyId, corrections } = z
      .object({ familyId: z.string().uuid(), corrections: familyCorrectionsSchema })
      .strict()
      .parse(await request.json());
    const known = await db
      .from("lightspeed_import_reviews")
      .select("family_id")
      .eq("tenant_id", tenantId)
      .eq("family_id", familyId)
      .maybeSingle();
    if (known.error) throw known.error;
    if (!known.data) return reply({ error: "Review not found" }, 404);
    const store = new SupabaseCatalogReconciliationStore(db);
    const runId = await store.startRun(tenantId, session.user.id, "family");
    const summary: ReconciliationSummary = {
      scope: "family",
      created: 0,
      updated: 0,
      skipped: 0,
      retired: 0,
      failed: 0,
    };
    let raw: unknown;
    let saved = false;
    try {
      if (!corrections.exclude) {
        raw = await loadLightspeedFamily(familyId);
        const view = describeLightspeedFamily(raw, corrections);
        if (
          Object.keys(corrections.variants ?? {}).some(
            (id) => !view.variants.some((v) => v.id === id),
          )
        )
          throw new Error(
            "The provider variants changed. Reload this review before saving.",
          );
      }
      const result = await db
        .from("lightspeed_import_reviews")
        .update({
          corrections: corrections as Json,
          updated_by: session.user.id,
          updated_at: new Date().toISOString(),
          resolved: false,
          ...(raw ? { source_payload: raw as Json } : {}),
        })
        .eq("tenant_id", tenantId)
        .eq("family_id", familyId);
      if (result.error) throw result.error;
      saved = true;
      const families = normalizeLightspeedFamily(raw, corrections);
      if (families.length) summary[await store.applyFamily(runId, tenantId, families)]++;
      else {
        summary.retired = await store.retireMissingFamilies(
          runId,
          tenantId,
          new Set(),
          familyId,
        );
        summary.skipped++;
        await store.resolveReview(tenantId, familyId);
      }
      await store.finishRun(runId, "success", summary);
      return reply({
        resolved: true,
        message: corrections.exclude
          ? "Excluded from website imports."
          : "Saved and imported successfully.",
      });
    } catch (error) {
      summary.failed = 1;
      const reason = safeError(error);
      try {
        await store.recordFailure(runId, familyId, reason, raw);
      } finally {
        await store.finishRun(runId, "failed", summary);
      }
      return reply(
        {
          resolved: false,
          error: reason,
          saved,
          message: saved
            ? "Corrections saved. This product still needs attention."
            : "Corrections were not saved.",
        },
        422,
      );
    }
  } catch (error) {
    return failure(error);
  }
}
