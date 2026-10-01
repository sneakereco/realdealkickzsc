import { after } from "next/server";

import {
  captureLightspeedWebhook,
  LightspeedWebhookError,
  processLightspeedWebhookEvent,
} from "@/modules/lightspeed/webhook-server";
import { logError } from "@/lib/utils/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  try {
    const captured = await captureLightspeedWebhook({
      rawBody: await request.text(),
      callbackToken: new URL(request.url).searchParams.get("token"),
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
          await processLightspeedWebhookEvent(captured.row.id);
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
