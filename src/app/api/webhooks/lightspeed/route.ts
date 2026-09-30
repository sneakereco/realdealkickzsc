import { after } from "next/server";

import {
  captureLightspeedWebhook,
  LightspeedWebhookError,
  processLightspeedWebhookEvent,
  webhookRunId,
} from "@/modules/lightspeed/webhook-server";
import { logError } from "@/lib/utils/log";
import { runSyncWorker } from "@/modules/lightspeed/sync-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  try {
    const captured = await captureLightspeedWebhook({
      rawBody: await request.text(),
      signatureHeader: request.headers.get("x-signature"),
      contentType: request.headers.get("content-type"),
    });
    const due = new Date(captured.row.next_attempt_at).getTime() <= Date.now();
    if (
      !captured.duplicate ||
      captured.row.state === "pending" ||
      (captured.row.state === "retry_wait" && due)
    ) {
      after(async () => {
        try {
          const event = await processLightspeedWebhookEvent(captured.row.id);
          const runId = webhookRunId(event);
          if (runId && event.state === "processing") await runSyncWorker(runId);
        } catch (error) {
          logError(error, {
            layer: "api",
            event: "lightspeed_webhook_processing",
            webhookEventId: captured.row.id,
          });
        }
      });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof LightspeedWebhookError) {
      return new Response(null, { status: error.status });
    }
    logError(error, { layer: "api", event: "lightspeed_webhook_capture" });
    return new Response(null, { status: 500 });
  }
}
