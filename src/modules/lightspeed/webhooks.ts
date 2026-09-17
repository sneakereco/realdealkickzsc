import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

export function verifyLightspeedSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  const supplied = parseSignature(header);
  if (!supplied || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
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
  const bodySha256 = createHash("sha256").update(rawBody, "utf8").digest("hex");
  return {
    eventId:
      resourceVersion === null
        ? `${type}:${resourceId}:sha256:${bodySha256}`
        : `${type}:${resourceId}:${resourceVersion}`,
    type,
    domainPrefix,
    retailerId: payload.retailer_id ?? null,
    resourceId,
    resourceVersion,
    outletId:
      type === "inventory.update"
        ? (payload as z.infer<(typeof schemas)["inventory.update"]>).outlet_id
        : null,
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

function parseSignature(header: string | null): Buffer | null {
  if (!header) return null;
  const fields = new Map<string, string>();
  for (const segment of header.split(",")) {
    const separator = segment.indexOf("=");
    if (separator <= 0) return null;
    const key = segment.slice(0, separator).trim().toLowerCase();
    const value = segment.slice(separator + 1).trim();
    if (!key || !value || fields.has(key)) return null;
    fields.set(key, value);
  }
  if (fields.size !== 2 || fields.get("algorithm") !== "HMAC-SHA256") return null;
  const encoded = fields.get("signature");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const digest = Buffer.from(encoded, "base64");
  return digest.length === 32 && digest.toString("base64") === encoded ? digest : null;
}
