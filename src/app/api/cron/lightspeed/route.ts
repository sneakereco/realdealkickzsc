import { createSupabaseAdminClient } from "@/lib/supabase/service-role";
import { logError } from "@/lib/utils/log";
import { recoverLegacySyncs, workSync } from "@/modules/lightspeed/sync-jobs";
import {
  processLightspeedWebhookEvent,
  webhookRunId,
} from "@/modules/lightspeed/webhook-server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = createSupabaseAdminClient();
    await recoverLegacySyncs(db);
    const now = new Date().toISOString();
    // One bounded worker per invocation. The database lease rejects overlapping cron ticks.
    const runs = await db
      .from("lightspeed_sync_runs")
      .select("id")
      .eq("status", "running")
      .not("checkpoint", "is", null)
      .or(`lease_until.is.null,lease_until.lte.${now}`)
      .order("created_at")
      .limit(1);
    if (runs.error) throw runs.error;
    if (runs.data?.[0]) {
      await workSync(runs.data[0].id, db);
      return Response.json({ ok: true });
    }
    const events = await db
      .from("lightspeed_webhook_events")
      .select("id")
      .in("state", ["pending", "retry_wait", "processing"])
      .lte("next_attempt_at", now)
      .order("next_attempt_at")
      .limit(20);
    if (events.error) throw events.error;
    for (const row of events.data ?? []) {
      const event = await processLightspeedWebhookEvent(row.id, db);
      const runId = webhookRunId(event);
      if (runId && event.state === "processing") {
        await workSync(runId, db);
        break;
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    logError(error, { layer: "api", endpoint: "/api/cron/lightspeed" });
    return Response.json(
      { error: "Sync worker failed; see runtime logs" },
      { status: 500 },
    );
  }
}
