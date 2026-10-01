import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const id = z.string().trim().min(1);
const version = z.number().int().nonnegative().safe();
const common = { retailer_id: id.optional(), version: version.optional() };
const schemas = {
  "product.update": z.object({ ...common, id }),
  "inventory.update": z.object({
    ...common,
    product_id: id,
    outlet_id: id,
    version,
  }),
  "sale.update": z.object({ ...common, id }),
} as const;

export type LightspeedWebhookType = keyof typeof schemas;

export interface SanitizedLightspeedWebhook {
  eventId: string;
  type: LightspeedWebhookType;
  domainPrefix: string;
  retailerId: string | null;
  resourceId: string;
  resourceVersion: number | null;
  outletId: string | null;
  bodySha256: string;
}

export function verifyLightspeedCallbackToken(
  token: string | null,
  secret: string,
): boolean {
  if (!/^[a-f0-9]{64}$/.test(secret) || !token || !/^[a-f0-9]{64}$/.test(token))
    return false;
  return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(secret, "hex"));
}

export function parseLightspeedWebhook(rawBody: string): SanitizedLightspeedWebhook {
  const form = new URLSearchParams(rawBody);
  const type = single(form, "type") as LightspeedWebhookType;
  const schema = schemas[type];
  if (!schema) throw new Error("webhook_type_invalid");
  const domainPrefix = single(form, "domain_prefix").trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(domainPrefix)) {
    throw new Error("webhook_domain_invalid");
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(single(form, "payload"));
  } catch {
    throw new Error("webhook_payload_json_invalid");
  }
  const parsed = schema.safeParse(rawPayload);
  if (!parsed.success) throw new Error(`webhook_payload_invalid:${type}`);

  const payload = parsed.data;
  const resourceId =
    type === "inventory.update"
      ? (payload as z.infer<(typeof schemas)["inventory.update"]>).product_id
      : (payload as z.infer<(typeof schemas)["product.update"]>).id;
  const resourceVersion = payload.version ?? null;
  const outletId =
    type === "inventory.update"
      ? (payload as z.infer<(typeof schemas)["inventory.update"]>).outlet_id
      : null;
  const retailerId = form.has("retailer_id")
    ? single(form, "retailer_id")
    : (payload.retailer_id ?? null);
  if (retailerId && payload.retailer_id && retailerId !== payload.retailer_id)
    throw new Error("webhook_retailer_mismatch");
  const bodySha256 = createHash("sha256").update(rawBody, "utf8").digest("hex");
  return {
    eventId:
      resourceVersion === null
        ? `${type}:${resourceId}:sha256:${bodySha256}`
        : `${type}:${resourceId}:${outletId ? `${outletId}:` : ""}${resourceVersion}`,
    type,
    domainPrefix,
    retailerId,
    resourceId,
    resourceVersion,
    outletId,
    bodySha256,
  };
}

export function isLightspeedEventOutOfOrder(
  resourceVersion: number | null,
  latestAppliedVersion: number | null,
): boolean {
  return (
    resourceVersion !== null &&
    latestAppliedVersion !== null &&
    resourceVersion < latestAppliedVersion
  );
}

function single(form: URLSearchParams, name: string): string {
  const values = form.getAll(name);
  if (values.length !== 1 || !values[0].trim()) {
    throw new Error(`webhook_${name}_count_invalid`);
  }
  return values[0];
}
