import "server-only";

import {
  createSupabaseAdminClient,
  type AdminSupabaseClient,
} from "@/lib/supabase/service-role";
import { logError } from "@/lib/utils/log";
import type { Json, Tables } from "@/types/db/database.types";
import { advanceSync, newCheckpoint, newSummary, type SyncCheckpoint } from "./batches";
import {
  allItemsFailed,
  reconcileFamily,
  safeError,
  type ReconciliationSummary,
} from "./reconciliation";
import {
  loadLightspeedFamily,
  loadLightspeedFamilyPage,
  SupabaseCatalogReconciliationStore,
} from "./server";

type SyncRun = Tables<"lightspeed_sync_runs">;
export function publicSyncRun(run: SyncRun) {
  return {
    id: run.id,
    status: run.status,
    summary: run.summary,
    created_at: run.created_at,
    completed_at: run.completed_at,
    cancel_requested_at: run.cancel_requested_at,
  };
}

export async function recoverLegacySyncs(db: AdminSupabaseClient, tenantId?: string) {
  const result = await db.rpc("recover_legacy_lightspeed_sync", {
    p_tenant_id: tenantId,
  });
  if (result.error) throw result.error;
}

export async function enqueueSync(
  tenantId: string,
  userId: string | null,
  db = createSupabaseAdminClient(),
  eventId?: string,
) {
  if (process.env.VERCEL && !process.env.CRON_SECRET)
    throw new Error("lightspeed_worker_not_configured");
  await recoverLegacySyncs(db, tenantId);
  const summary = newSummary();
  summary.progress = {
    phase: "listing",
    completed: 0,
    total: null,
    updated_at: new Date().toISOString(),
  };
  const result = await db.rpc("enqueue_lightspeed_sync", {
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_checkpoint: { ...newCheckpoint() },
    p_summary: { ...summary } as Json,
    p_event_id: eventId,
  });
  if (result.error?.code === "23505")
    throw new Error("lightspeed_reconciliation_already_running");
  if (result.error) throw result.error;
  return result.data as unknown as SyncRun;
}

export async function cancelSync(
  runId: string,
  tenantId: string,
  db = createSupabaseAdminClient(),
) {
  await recoverLegacySyncs(db, tenantId);
  const result = await db.rpc("cancel_lightspeed_sync", {
    p_run_id: runId,
    p_tenant_id: tenantId,
  });
  if (result.error) throw result.error;
  return result.data ? publicSyncRun(result.data as unknown as SyncRun) : null;
}

export async function workSync(runId: string, db = createSupabaseAdminClient()) {
  const claim = await db.rpc("claim_lightspeed_sync", { p_run_id: runId });
  if (claim.error) throw claim.error;
  if (!claim.data) return;
  let run = claim.data as unknown as SyncRun;
  const token = run.lease_token!;
  const checkpoint = run.checkpoint as unknown as SyncCheckpoint;
  const summary = run.summary as unknown as ReconciliationSummary;
  // Leave a full minute for cleanup before Vercel's 300-second hard stop.
  const signal = AbortSignal.timeout(240_000);
  const store = new SupabaseCatalogReconciliationStore(createSupabaseAdminClient(signal));
  const deadline = Date.now() + 180_000;
  async function save(
    status: "running" | "success" | "partial_failure" | "failed",
    release: boolean,
  ) {
    const result = await db.rpc("save_lightspeed_sync", {
      p_run_id: run.id,
      p_token: token,
      p_checkpoint: { ...checkpoint },
      p_summary: { ...summary } as Json,
      p_status: status,
      p_release: release,
    });
    if (result.error) throw result.error;
    if (!result.data) return false;
    run = result.data as unknown as SyncRun;
    return run.status === "running";
  }
  async function checkActive() {
    signal.throwIfAborted();
    const result = await db
      .from("lightspeed_sync_runs")
      .select("status, lease_token, lease_until, cancel_requested_at")
      .eq("id", run.id)
      .single();
    if (result.error) throw result.error;
    if (
      result.data.status !== "running" ||
      result.data.lease_token !== token ||
      Date.parse(result.data.lease_until ?? "") <= Date.now()
    )
      throw new Error("sync_lease_lost");
    if (result.data.cancel_requested_at) throw new Error("sync_cancel_requested");
  }
  try {
    while (Date.now() < deadline) {
      await checkActive();
      await advanceSync(checkpoint, summary, {
        list: (cursor) => loadLightspeedFamilyPage(cursor, signal),
        apply: async (id) => {
          const raw = await loadLightspeedFamily(id, true, signal);
          await checkActive();
          return reconcileFamily(raw, run.id, run.tenant_id, store, summary);
        },
        nextLinked: async (after) => {
          let query = db
            .from("lightspeed_product_links")
            .select("lightspeed_family_id")
            .eq("tenant_id", run.tenant_id)
            .eq("sync_state", "linked")
            .not("lightspeed_family_id", "is", null)
            .order("lightspeed_family_id")
            .limit(1);
          if (after !== null) query = query.gt("lightspeed_family_id", after);
          const result = await query;
          if (result.error) throw result.error;
          return result.data?.[0]?.lightspeed_family_id ?? null;
        },
        retire: async (id) => {
          await checkActive();
          return store.retireMissingFamilies(run.id, run.tenant_id, new Set(), id);
        },
      });
      if (checkpoint.phase === "done") {
        const status = allItemsFailed(summary)
          ? "failed"
          : summary.failed
            ? "partial_failure"
            : "success";
        if (status === "failed") {
          summary.error =
            "Sync failed: every product family failed. See error details below.";
          summary.progress!.phase = "failed";
        }
        await save(status, true);
        return;
      }
      if (!(await save("running", false))) return;
    }
    await save("running", true);
  } catch (error) {
    const reason = safeError(error);
    if (reason === "sync_lease_lost") return;
    summary.error =
      reason === "lightspeed_request_timeout"
        ? "Lightspeed did not respond within 30 seconds. Start a new sync to retry."
        : `Sync stopped: ${reason.slice(0, 1000)}. Use the run ID to find its server logs.`;
    summary.progress = {
      phase: "failed",
      completed: checkpoint.index,
      total: checkpoint.ids.length,
      updated_at: new Date().toISOString(),
    };
    logError(error, {
      layer: "service",
      event: "lightspeed_sync_worker",
      runId: run.id,
      phase: checkpoint.phase,
      familyId: checkpoint.ids[checkpoint.index],
    });
    await save("failed", true);
  }
}

// Used in Next's after() callbacks: keep unexpected database failures in runtime logs.
export async function runSyncWorker(runId: string) {
  try {
    await workSync(runId);
  } catch (error) {
    logError(error, { layer: "service", event: "lightspeed_sync_worker", runId });
  }
}
