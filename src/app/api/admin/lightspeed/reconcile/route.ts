import { after, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAdminApi } from "@/lib/auth/session";
import {
  cancelSync,
  enqueueSync,
  publicSyncRun,
  recoverLegacySyncs,
  runSyncWorker,
} from "@/modules/lightspeed/sync-jobs";
import {
  allItemsFailed,
  groupFailures,
  type ReconciliationSummary,
} from "@/modules/lightspeed/reconciliation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/service-role";
import { logError } from "@/lib/utils/log";

export const maxDuration = 300;

export async function GET() {
  try {
    const session = await requireAdminApi();
    const tenantId = session.profile?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Admin tenant is required" }, { status: 400 });
    }
    await recoverLegacySyncs(createSupabaseAdminClient(), tenantId);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("lightspeed_sync_runs")
      .select("id, status, summary, created_at, completed_at, cancel_requested_at")
      .eq("tenant_id", tenantId)
      .not("summary", "cs", '{"scope":"family"}')
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const summary = (data.summary ?? {}) as Partial<ReconciliationSummary>;
      if ((summary.failed ?? 0) > 0 && !summary.failure_groups) {
        const items: Array<{ entity_key: string | null; failure_reason: string | null }> =
          [];
        for (let offset = 0; ; offset += 1000) {
          const page = await supabase
            .from("lightspeed_sync_run_items")
            .select("entity_key, failure_reason")
            .eq("tenant_id", tenantId)
            .eq("sync_run_id", data.id)
            .eq("apply_status", "failed")
            .order("id")
            .range(offset, offset + 999);
          if (page.error) throw page.error;
          items.push(...(page.data ?? []));
          if (!page.data || page.data.length < 1000) break;
        }
        summary.failure_groups = groupFailures(items);
      }
      if (data.status === "partial_failure" && allItemsFailed(summary)) {
        data.status = "failed";
        summary.error ??=
          "Sync failed: every product family failed. See error details below.";
        if (summary.progress) summary.progress = { ...summary.progress, phase: "failed" };
      }
      data.summary = { ...summary };
    }
    return NextResponse.json({ run: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const session = await requireAdminApi();
    const tenantId = session.profile?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Admin tenant is required" }, { status: 400 });
    }
    const run = await enqueueSync(tenantId, session.user.id);
    after(() => runSyncWorker(run.id));
    return NextResponse.json(
      { run: publicSyncRun(run) },
      {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdminApi();
    const tenantId = session.profile?.tenant_id;
    if (!tenantId)
      return NextResponse.json({ error: "Admin tenant is required" }, { status: 400 });
    const parsed = z
      .object({ runId: z.uuid() })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json({ error: "A valid run ID is required" }, { status: 400 });
    const run = await cancelSync(parsed.data.runId, tenantId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  logError(error, { layer: "api", endpoint: "/api/admin/lightspeed/reconcile" });
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message === "lightspeed_worker_not_configured") {
    return NextResponse.json(
      {
        error:
          "Background sync is not configured. Set CRON_SECRET in this Vercel project and redeploy.",
      },
      { status: 503 },
    );
  }
  if (
    error instanceof Error &&
    error.message === "lightspeed_reconciliation_already_running"
  ) {
    return NextResponse.json(
      { error: "A Lightspeed sync is already running" },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { error: "Lightspeed reconciliation failed" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
