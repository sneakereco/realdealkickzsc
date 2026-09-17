import "server-only";

import type { AdminSupabaseClient } from "@/lib/supabase/service-role";
import { createSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { Json, Tables } from "@/types/db/database.types";

import { reconcileCatalog } from "./reconciliation";
import { loadLightspeedFamilies, SupabaseCatalogReconciliationStore } from "./server";
import {
  isLightspeedEventOutOfOrder,
  parseLightspeedWebhook,
  type SanitizedLightspeedWebhook,
  verifyLightspeedSignature,
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
  signatureHeader: string | null;
  contentType: string | null;
  db?: AdminSupabaseClient;
}): Promise<{ row: WebhookRow; duplicate: boolean }> {
  const secret = process.env.LIGHTSPEED_WEBHOOK_SECRET;
  if (!secret) throw new LightspeedWebhookError(503, "webhook_not_configured");
  if (!verifyLightspeedSignature(input.rawBody, input.signatureHeader, secret)) {
    throw new LightspeedWebhookError(401, "webhook_signature_invalid");
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
  const { data: settings, error: settingsError } = await db
    .from("tenant_lightspeed_settings")
    .select("tenant_id, domain_prefix, retailer_id")
    .eq("domain_prefix", event.domainPrefix)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings) throw new LightspeedWebhookError(404, "webhook_tenant_not_found");
  if (event.retailerId && event.retailerId !== settings.retailer_id) {
    throw new LightspeedWebhookError(400, "webhook_retailer_mismatch");
  }

  const existing = await findEvent(db, settings.tenant_id, event.eventId);
  if (existing) return { row: existing, duplicate: true };

  const { data, error } = await db
    .from("lightspeed_webhook_events")
    .insert({
      tenant_id: settings.tenant_id,
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
    const raced = await findEvent(db, settings.tenant_id, event.eventId);
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
  if (!event.tenant_id) throw new Error("webhook_tenant_missing");
  const tenantId = event.tenant_id;

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
    const summary = await reconcileCatalog({
      tenantId,
      userId: null,
      loadFamilies: loadLightspeedFamilies,
      store: new SupabaseCatalogReconciliationStore(db),
    });
    if (summary.failed > 0) {
      throw new Error(`reconciliation_partial_failure:${summary.failed}`);
    }
    return updateEvent(db, event.id, {
      state: "succeeded",
      processed_at: new Date().toISOString(),
      lease_until: null,
      outcome: { provider_event_id: event.event_id, summary: { ...summary } },
      last_error: null,
    });
  } catch (error) {
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
