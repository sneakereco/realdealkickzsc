import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isLightspeedEventOutOfOrder,
  parseLightspeedWebhook,
  verifyLightspeedSignature,
} from "../src/lib/lightspeed/webhooks";

const fixtures = ["product-update", "inventory-update", "sale-update"];

for (const name of fixtures) {
  void test(`parses and sanitizes the ${name} contract fixture`, async () => {
    const raw = await readFile(
      new URL(`./fixtures/lightspeed/webhooks/${name}.form.txt`, import.meta.url),
      "utf8",
    );
    const event = parseLightspeedWebhook(raw.trim());

    assert.equal(event.domainPrefix, "rdk-sandbox");
    assert.equal(JSON.stringify(event).includes("customer"), false);
    assert.match(event.eventId, new RegExp(`^${event.type}:`));
  });
}

void test("rejects invalid signatures with a timing-safe HMAC check", () => {
  const raw = "type=product.update&payload=%7B%22id%22%3A%22p1%22%7D";
  const secret = "test-secret";
  const signature = createHmac("sha256", secret).update(raw).digest("base64");

  assert.equal(
    verifyLightspeedSignature(
      raw,
      `algorithm=HMAC-SHA256,signature=${signature}`,
      secret,
    ),
    true,
  );
  assert.equal(
    verifyLightspeedSignature(raw, "algorithm=HMAC-SHA256,signature=invalid", secret),
    false,
  );
});

void test("uses provider identity and version for replay and out-of-order ordering", async () => {
  const raw = await readFile(
    new URL("./fixtures/lightspeed/webhooks/product-update.form.txt", import.meta.url),
    "utf8",
  );
  const event = parseLightspeedWebhook(raw.trim());
  const replay = parseLightspeedWebhook(raw.trim());

  assert.equal(event.eventId, "product.update:product-10:5303657190");
  assert.equal(replay.eventId, event.eventId);
  assert.equal(event.resourceVersion, 5303657190);
  assert.equal(isLightspeedEventOutOfOrder(event.resourceVersion, 5303657191), true);
  assert.equal(isLightspeedEventOutOfOrder(event.resourceVersion, 5303657189), false);
});

void test("database delivery state enforces replay deduplication and retry leases", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260917160000_lightspeed_webhook_processing.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /unique index[\s\S]+\(tenant_id, event_id\)/i);
  assert.match(migration, /lease_until timestamptz/i);
  assert.match(migration, /retry_wait/);
});
