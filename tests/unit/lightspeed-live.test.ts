import { afterEach, expect, test, vi } from "vitest";
import type { AdminSupabaseClient } from "@/lib/supabase/service-role";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  finish: vi.fn(),
  reconcile: vi.fn(),
  family: vi.fn(),
  retire: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  env: { LIGHTSPEED_DOMAIN_PREFIX: "test-store", LIGHTSPEED_ACCESS_TOKEN: "test-token" },
}));
vi.mock("@/modules/lightspeed/server", () => ({
  loadLightspeedFamily: mocks.family,
  SupabaseCatalogReconciliationStore: class {
    startRun = mocks.start;
    finishRun = mocks.finish;
    retireMissingFamilies = mocks.retire;
  },
}));
vi.mock("@/modules/lightspeed/reconciliation", () => ({
  reconcileFamily: mocks.reconcile,
}));

import { runLiveSync } from "@/modules/lightspeed/live-sync";
import {
  verifyLightspeedCallbackToken,
  parseLightspeedWebhook,
} from "@/modules/lightspeed/webhooks";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("private-app callbacks use a separate strong URL token, with no signature required", () => {
  const secret = "a".repeat(64);
  expect(verifyLightspeedCallbackToken(secret, secret)).toBe(true);
  expect(verifyLightspeedCallbackToken(null, secret)).toBe(false);
  expect(verifyLightspeedCallbackToken("b".repeat(64), secret)).toBe(false);
  expect(verifyLightspeedCallbackToken("short", "short")).toBe(false);
});

test("uses the envelope retailer and scopes inventory replay identity to the outlet", () => {
  const form = (outlet: string) =>
    new URLSearchParams({
      type: "inventory.update",
      retailer_id: "retailer",
      domain_prefix: "test-store",
      payload: JSON.stringify({ product_id: "p1", outlet_id: outlet, version: 10 }),
    }).toString();
  expect(parseLightspeedWebhook(form("a")).retailerId).toBe("retailer");
  expect(parseLightspeedWebhook(form("a")).eventId).not.toBe(
    parseLightspeedWebhook(form("b")).eventId,
  );
});

type Row = Record<string, unknown>;
function database() {
  const rows: Record<string, Row[]> = {
    lightspeed_product_links: [
      {
        tenant_id: "tenant",
        lightspeed_product_id: "p1",
        lightspeed_family_id: "f1",
        product_id: "local",
        variant_id: "v1",
        sync_state: "linked",
      },
    ],
    product_variants: [{ id: "v1", tenant_id: "tenant", product_id: "local", stock: 3 }],
    products: [
      { id: "local", tenant_id: "tenant", is_out_of_stock: false, archived_at: null },
    ],
  };
  const db = {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let update: Row | undefined;
      let one = false;
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          filters.push((r) => r[key] === value);
          return q;
        },
        in: (key: string, value: unknown[]) => {
          filters.push((r) => value.includes(r[key]));
          return q;
        },
        gt: (key: string, value: number) => {
          filters.push((r) => Number(r[key]) > value);
          return q;
        },
        limit: () => q,
        maybeSingle: () => {
          one = true;
          return q;
        },
        update: (value: Row) => {
          update = value;
          return q;
        },
        then: (resolve: (value: unknown) => unknown) => {
          const matches = (rows[table] ?? []).filter((r) => filters.every((f) => f(r)));
          if (update) matches.forEach((r) => Object.assign(r, update));
          return Promise.resolve(
            resolve({ data: one ? (matches[0] ?? null) : matches, error: null }),
          );
        },
      };
      return q;
    },
  } as unknown as AdminSupabaseClient;
  return { db, rows };
}

function provider(quantity: number) {
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-token");
    if (url.endsWith("/products/p1"))
      return Promise.resolve(
        Response.json({
          data: {
            id: "p1",
            family_id: "f1",
            active: { in_store: true },
            deleted_at: null,
          },
        }),
      );
    if (url.endsWith("/inventory"))
      return Promise.resolve(
        Response.json([{ product_id: "p1", current_inventory_level: quantity }]),
      );
    if (url.endsWith("/sales/s1"))
      return Promise.resolve(
        Response.json({ data: { line_items: [{ product: { id: "p1" } }] } }),
      );
    throw new Error(`Unexpected provider URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  mocks.start.mockResolvedValue("run");
  mocks.finish.mockResolvedValue(undefined);
  return fetcher;
}

test("POS sale and return copy fresh provider quantities and restore availability without a catalog scan", async () => {
  const { db, rows } = database();
  provider(0);
  await runLiveSync("tenant", { topic: "inventory.update", resource_id: "p1" }, db);
  expect(rows.product_variants[0].stock).toBe(0);
  expect(rows.products[0].is_out_of_stock).toBe(true);
  provider(2);
  await runLiveSync("tenant", { topic: "sale.update", resource_id: "s1" }, db);
  expect(rows.product_variants[0].stock).toBe(2);
  expect(rows.products[0].is_out_of_stock).toBe(false);
  expect(mocks.family).not.toHaveBeenCalled();
  expect(mocks.start).toHaveBeenCalledWith("tenant", null, "family");
  expect(mocks.finish).toHaveBeenLastCalledWith(
    "run",
    "success",
    expect.objectContaining({ scope: "family" }),
  );
});

test("product creation/edit applies only the affected family through existing mappings", async () => {
  const { db } = database();
  provider(3);
  const raw = { data: { id: "f1" } };
  mocks.family.mockResolvedValue(raw);
  mocks.reconcile.mockResolvedValue(true);
  await runLiveSync("tenant", { topic: "product.update", resource_id: "p1" }, db);
  expect(mocks.family).toHaveBeenCalledWith("f1", true, expect.any(AbortSignal));
  expect(mocks.reconcile).toHaveBeenCalledWith(
    raw,
    "run",
    "tenant",
    expect.anything(),
    expect.objectContaining({ scope: "family" }),
  );
});

test("an active manual sync defers live work before any provider fetch or catalog write", async () => {
  const { db, rows } = database();
  const fetcher = provider(0);
  mocks.start.mockRejectedValueOnce(
    new Error("lightspeed_reconciliation_already_running"),
  );
  await expect(
    runLiveSync("tenant", { topic: "inventory.update", resource_id: "p1" }, db),
  ).rejects.toThrow("lightspeed_reconciliation_already_running");
  expect(fetcher).not.toHaveBeenCalled();
  expect(rows.product_variants[0].stock).toBe(3);
});

test("missing provider inventory preserves stock and records a retryable failure", async () => {
  const { db, rows } = database();
  const fetcher = provider(3);
  fetcher.mockImplementation(() =>
    Promise.resolve(
      Response.json({ data: { id: "p1", family_id: "f1", active: { in_store: true } } }),
    ),
  );
  await expect(
    runLiveSync("tenant", { topic: "inventory.update", resource_id: "p1" }, db),
  ).rejects.toThrow();
  expect(rows.product_variants[0].stock).toBe(3);
  expect(mocks.finish).toHaveBeenCalledWith(
    "run",
    "failed",
    expect.objectContaining({ scope: "family" }),
  );
});
