import "server-only";

import type { AdminSupabaseClient } from "@/lib/supabase/service-role";
import { createSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { Json, Tables } from "@/types/db/database.types";

import { runLiveSync } from "./live-sync";
import {
  isLightspeedEventOutOfOrder,
  parseLightspeedWebhook,
  type SanitizedLightspeedWebhook,
  verifyLightspeedCallbackToken,
} from "./webhooks";

type WebhookRow = Tables<"lightspeed_webhook_events">;

export class LightspeedWebhookError extends Error {
  constructor(
    public readonly status: 400 | 401 | 404 | 503,
    message: string,
  ) {
    super(message);
  }
}

export async function captureLightspeedWebhook(input: {
  rawBody: string;
  callbackToken: string | null;
  contentType: string | null;
  db?: AdminSupabaseClient;
}): Promise<{ row: WebhookRow; duplicate: boolean }> {
  const secret = process.env.LIGHTSPEED_WEBHOOK_ROUTE_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret))
    throw new LightspeedWebhookError(503, "webhook_not_configured");
  if (!verifyLightspeedCallbackToken(input.callbackToken, secret)) {
    throw new LightspeedWebhookError(401, "webhook_token_invalid");
  }
  if (
    input.contentType?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/x-www-form-urlencoded"
  ) {
    throw new LightspeedWebhookError(400, "webhook_content_type_invalid");
  }

  let event: SanitizedLightspeedWebhook;
  try {
    event = parseLightspeedWebhook(input.rawBody);
  } catch (error) {
    throw new LightspeedWebhookError(
      400,
      error instanceof Error ? error.message : "webhook_payload_invalid",
    );
  }
  if (event.domainPrefix !== process.env.LIGHTSPEED_DOMAIN_PREFIX?.trim().toLowerCase()) {
    throw new LightspeedWebhookError(400, "webhook_domain_mismatch");
  }

  const db = input.db ?? createSupabaseAdminClient();
  const { data: tenants, error: tenantError } = await db
    .from("tenants")
    .select("id")
    .limit(2);
  if (tenantError) throw tenantError;
  if (tenants?.length !== 1) {
    throw new LightspeedWebhookError(503, "webhook_requires_single_tenant");
  }
  const tenantId = tenants[0].id;

  const existing = await findEvent(db, tenantId, event.eventId);
  if (existing) return { row: existing, duplicate: true };

  const { data, error } = await db
    .from("lightspeed_webhook_events")
    .insert({
      tenant_id: tenantId,
      event_id: event.eventId,
      topic: event.type,
      resource_id: event.resourceId,
      resource_version: event.resourceVersion,
      payload: { ...event } as Json,
      state: "pending",
    })
    .select()
    .single();
  if (error?.code === "23505") {
    const raced = await findEvent(db, tenantId, event.eventId);
    if (raced) return { row: raced, duplicate: true };
  }
  if (error) throw error;
  return { row: data, duplicate: false };
}

export async function processLightspeedWebhookEvent(
  id: string,
  db: AdminSupabaseClient = createSupabaseAdminClient(),
): Promise<WebhookRow> {
  const loaded = await db
    .from("lightspeed_webhook_events")
    .select("*")
    .eq("id", id)
    .single();
  if (loaded.error) throw loaded.error;
  let event = loaded.data;
  if (event.state === "succeeded") return event;
  if (!event.tenant_id || !event.resource_id)
    return updateEvent(db, event.id, {
      state: "needs_attention",
      lease_until: null,
      last_error:
        "Legacy event lacks store or resource identity; review before retrying.",
    });
  const tenantId = event.tenant_id;

  const linkedRunId = webhookRunId(event);
  if (event.state === "processing" && linkedRunId) {
    const run = await db
      .from("lightspeed_sync_runs")
      .select("status, summary")
      .eq("id", linkedRunId)
      .eq("tenant_id", tenantId)
      .single();
    if (run.error) throw run.error;
    if (run.data.status === "running") return event;
    const summary = run.data.summary as { error?: string };
    return updateEvent(db, event.id, {
      state: run.data.status === "success" ? "succeeded" : "needs_attention",
      processed_at: new Date().toISOString(),
      lease_until: null,
      last_error:
        run.data.status === "success"
          ? null
          : (summary.error ?? `Sync ${run.data.status}. Review run ${linkedRunId}.`),
    });
  }

  if (event.resource_version !== null && event.resource_id) {
    const newer = await db
      .from("lightspeed_webhook_events")
      .select("id, resource_version")
      .eq("tenant_id", tenantId)
      .eq("topic", event.topic)
      .eq("resource_id", event.resource_id)
      .eq("state", "succeeded")
      .not("resource_version", "is", null)
      .order("resource_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (newer.error) throw newer.error;
    if (
      newer.data &&
      isLightspeedEventOutOfOrder(event.resource_version, newer.data.resource_version)
    ) {
      return updateEvent(db, event.id, {
        state: "succeeded",
        processed_at: new Date().toISOString(),
        outcome: { result: "skipped_out_of_order", newer_event_id: newer.data.id },
        last_error: null,
      });
    }
  }

  const attempts = event.attempts + 1;
  const claim = await db
    .from("lightspeed_webhook_events")
    .update({
      state: "processing",
      attempts,
      lease_until: new Date(Date.now() + 10 * 60_000).toISOString(),
    })
    .eq("id", event.id)
    .or(
      `state.in.(pending,retry_wait,needs_attention),lease_until.lt.${new Date().toISOString()}`,
    )
    .select()
    .maybeSingle();
  if (claim.error) throw claim.error;
  if (!claim.data) return event;
  event = claim.data;
  try {
    const outcome = await runLiveSync(tenantId, event);
    return updateEvent(db, event.id, {
      state: "succeeded",
      processed_at: new Date().toISOString(),
      lease_until: null,
      outcome,
      last_error: null,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "lightspeed_reconciliation_already_running"
    ) {
      return updateEvent(db, event.id, {
        state: "pending",
        attempts: attempts - 1,
        lease_until: null,
        outcome: null,
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
      });
    }
    const terminal = attempts >= 5;
    return updateEvent(db, event.id, {
      state: terminal ? "needs_attention" : "retry_wait",
      lease_until: null,
      next_attempt_at: new Date(
        Date.now() + Math.min(2 ** attempts * 60_000, 3_600_000),
      ).toISOString(),
      last_error: safeError(error),
    });
  }
}

export function webhookRunId(event: Pick<WebhookRow, "outcome">): string | null {
  const outcome = event.outcome;
  return outcome &&
    typeof outcome === "object" &&
    !Array.isArray(outcome) &&
    typeof outcome.run_id === "string"
    ? outcome.run_id
    : null;
}

async function findEvent(db: AdminSupabaseClient, tenantId: string, eventId: string) {
  const { data, error } = await db
    .from("lightspeed_webhook_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateEvent(
  db: AdminSupabaseClient,
  id: string,
  values: Partial<WebhookRow>,
): Promise<WebhookRow> {
  const { data, error } = await db
    .from("lightspeed_webhook_events")
    .update(values)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

function safeError(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 300)
    : "webhook_processing_failed";
}
