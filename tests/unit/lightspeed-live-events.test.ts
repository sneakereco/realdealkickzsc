import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AdminSupabaseClient } from "@/lib/supabase/service-role";
const mocks = vi.hoisted(() => ({ live: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service-role", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/modules/lightspeed/live-sync", () => ({ runLiveSync: mocks.live }));
import {
  captureLightspeedWebhook,
  processLightspeedWebhookEvent,
} from "@/modules/lightspeed/webhook-server";

beforeEach(() => {
  vi.stubEnv("LIGHTSPEED_WEBHOOK_ROUTE_SECRET", "a".repeat(64));
  vi.stubEnv("LIGHTSPEED_DOMAIN_PREFIX", "test-store");
  mocks.live.mockResolvedValue({ run_id: "run", updated: 1 });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function database(state = "pending", attempts = 0, tenants = [{ id: "tenant" }]) {
  const event = {
    id: "event",
    tenant_id: "tenant",
    topic: "inventory.update",
    resource_id: "p1",
    resource_version: null,
    state,
    attempts,
    lease_until: null as string | null,
    outcome: null as unknown,
    processed_at: null as string | null,
    last_error: null as string | null,
    next_attempt_at: new Date(0).toISOString(),
  };
  const db = {
    from(table: string) {
      let change: Record<string, unknown> | undefined;
      let claiming = false;
      const q = {
        select: () => q,
        limit: () => q,
        eq: () => q,
        update: (value: Record<string, unknown>) => {
          change = value;
          return q;
        },
        or: () => {
          claiming = true;
          return q;
        },
        single: () => q,
        maybeSingle: () => q,
        then: (resolve: (value: unknown) => unknown) => {
          if (table === "tenants")
            return Promise.resolve(
              resolve({
                data: tenants,
                error: null,
              }),
            );
          if (
            claiming &&
            event.state === "processing" &&
            event.lease_until &&
            Date.parse(event.lease_until) > Date.now()
          )
            return Promise.resolve(resolve({ data: null, error: null }));
          if (change) Object.assign(event, change);
          return Promise.resolve(resolve({ data: { ...event }, error: null }));
        },
      };
      return q;
    },
  } as unknown as AdminSupabaseClient;
  return { db, event };
}
const body = new URLSearchParams({
  type: "inventory.update",
  domain_prefix: "test-store",
  retailer_id: "retailer",
  payload: JSON.stringify({ product_id: "p1", outlet_id: "o1", version: 1, count: 999 }),
}).toString();

test("rejects invalid callback credentials before database access", async () => {
  const db = { from: vi.fn() } as unknown as AdminSupabaseClient;
  await expect(
    captureLightspeedWebhook({
      rawBody: body,
      callbackToken: "wrong",
      contentType: "application/x-www-form-urlencoded",
      db,
    }),
  ).rejects.toMatchObject({ status: 401 });
  expect(db.from).not.toHaveBeenCalled();
});
test("recognizes duplicate delivery with a valid private-app callback token", async () => {
  const { db } = database("succeeded");
  await expect(
    captureLightspeedWebhook({
      rawBody: body,
      callbackToken: "a".repeat(64),
      contentType: "application/x-www-form-urlencoded",
      db,
    }),
  ).resolves.toMatchObject({ duplicate: true });
});

test.each([{ tenants: [] }, { tenants: [{ id: "one" }, { id: "two" }] }])(
  "rejects an absent or ambiguous tenant before capturing events: %j",
  async ({ tenants }) => {
    const { db } = database("pending", 0, tenants);
    await expect(
      captureLightspeedWebhook({
        rawBody: body,
        callbackToken: "a".repeat(64),
        contentType: "application/x-www-form-urlencoded",
        db,
      }),
    ).rejects.toMatchObject({ status: 503, message: "webhook_requires_single_tenant" });
  },
);

test("rejects another store domain before database access", async () => {
  const db = { from: vi.fn() } as unknown as AdminSupabaseClient;
  await expect(
    captureLightspeedWebhook({
      rawBody: body.replace("test-store", "other-store"),
      callbackToken: "a".repeat(64),
      contentType: "application/x-www-form-urlencoded",
      db,
    }),
  ).rejects.toMatchObject({ status: 400, message: "webhook_domain_mismatch" });
  expect(db.from).not.toHaveBeenCalled();
});
test("successful delivery invokes targeted work, records completion and ignores replay", async () => {
  const { db } = database();
  await expect(processLightspeedWebhookEvent("event", db)).resolves.toMatchObject({
    state: "succeeded",
    outcome: { run_id: "run" },
  });
  await processLightspeedWebhookEvent("event", db);
  expect(mocks.live).toHaveBeenCalledTimes(1);
});
test("manual overlap preserves the event without consuming its failure budget", async () => {
  const { db } = database();
  mocks.live.mockRejectedValueOnce(
    new Error("lightspeed_reconciliation_already_running"),
  );
  await expect(processLightspeedWebhookEvent("event", db)).resolves.toMatchObject({
    state: "pending",
    attempts: 0,
    lease_until: null,
  });
});
test.each([
  [0, "retry_wait"],
  [4, "needs_attention"],
])("provider failure after %s attempts records %s", async (attempts, state) => {
  const { db } = database("pending", attempts as number);
  mocks.live.mockRejectedValueOnce(new Error("lightspeed_live_request_failed:503"));
  await expect(processLightspeedWebhookEvent("event", db)).resolves.toMatchObject({
    state,
    last_error: "lightspeed_live_request_failed:503",
    lease_until: null,
  });
});
test("an active event lease prevents concurrent processing", async () => {
  const { db, event } = database("processing");
  event.lease_until = new Date(Date.now() + 600_000).toISOString();
  await processLightspeedWebhookEvent("event", db);
  expect(mocks.live).not.toHaveBeenCalled();
});

test("legacy events without a resource are surfaced without blocking the retry queue", async () => {
  const { db, event } = database();
  event.resource_id = "";
  await expect(processLightspeedWebhookEvent("event", db)).resolves.toMatchObject({
    state: "needs_attention",
  });
  expect(mocks.live).not.toHaveBeenCalled();
});
