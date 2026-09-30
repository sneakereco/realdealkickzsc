import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { newCheckpoint, newSummary } from "@/modules/lightspeed/batches";

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  list: vi.fn(),
  load: vi.fn(),
  apply: vi.fn(),
  retire: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createSupabaseAdminClient: mocks.db }));
vi.mock("@/modules/lightspeed/server", () => ({
  loadLightspeedFamilyPage: mocks.list,
  loadLightspeedFamily: mocks.load,
  SupabaseCatalogReconciliationStore: class {
    applyFamily = mocks.apply;
    retireMissingFamilies = mocks.retire;
  },
}));
import { workSync } from "@/modules/lightspeed/sync-jobs";
import type { AdminSupabaseClient } from "@/lib/supabase/service-role";

const raw = JSON.parse(
  readFileSync(
    new URL("../fixtures/lightspeed/manual-reconciliation.json", import.meta.url),
    "utf8",
  ),
);
let clock: number;
beforeEach(() => {
  vi.resetAllMocks();
  clock = Date.parse("2026-09-30T12:00:00Z");
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  mocks.load.mockResolvedValue(raw);
  mocks.apply.mockResolvedValue("updated");
});
afterEach(() => vi.restoreAllMocks());

function database() {
  const run = {
    id: "run",
    tenant_id: "tenant",
    status: "running",
    lease_token: null as string | null,
    lease_until: null as string | null,
    cancel_requested_at: null as string | null,
    checkpoint: newCheckpoint(),
    summary: newSummary(),
  };
  let nextToken = 0;
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === "claim_lightspeed_sync") {
        if (run.status !== "running" || run.lease_token)
          return Promise.resolve({ data: null, error: null });
        run.lease_token = `token-${++nextToken}`;
        run.lease_until = new Date(clock + 360_000).toISOString();
      } else if (name === "save_lightspeed_sync") {
        if (args.p_token !== run.lease_token)
          return Promise.resolve({ data: null, error: null });
        run.checkpoint = structuredClone(args.p_checkpoint) as typeof run.checkpoint;
        run.summary = structuredClone(args.p_summary) as typeof run.summary;
        run.status = run.cancel_requested_at ? "cancelled" : (args.p_status as string);
        if (args.p_release || run.status !== "running") run.lease_token = null;
        // Simulate a batch using its time budget. The next invocation must reload its checkpoint.
        clock += 181_000;
      }
      return Promise.resolve({ data: structuredClone(run), error: null });
    },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        not: () => query,
        order: () => query,
        limit: () => query,
        gt: () => query,
        single: () => Promise.resolve({ data: structuredClone(run), error: null }),
        then: (resolve: (value: unknown) => void) =>
          resolve({
            data: table === "lightspeed_product_links" ? [] : [run],
            error: null,
          }),
      };
      return query;
    },
  } as unknown as AdminSupabaseClient;
  mocks.db.mockReturnValue(db);
  return { db, run };
}

test("separate worker invocations resume listing and application then finish", async () => {
  const { db, run } = database();
  mocks.list
    .mockResolvedValueOnce({ ids: ["family-1"], cursor: 20, count: 1 })
    .mockResolvedValueOnce({ ids: [], cursor: 20, count: 0 });
  await workSync(run.id, db);
  expect(run.checkpoint).toMatchObject({ phase: "listing", cursor: 20 });
  expect(run.lease_token).toBeNull();
  await workSync(run.id, db);
  expect(run.checkpoint.phase).toBe("applying");
  await workSync(run.id, db);
  expect(run.summary.updated).toBe(1);
  expect(run.checkpoint.phase).toBe("retiring");
  await workSync(run.id, db);
  expect(run.status).toBe("success");
  expect(mocks.apply).toHaveBeenCalledTimes(1);
  expect(mocks.retire).not.toHaveBeenCalled();
});

test("cancellation arriving during download prevents that family's catalog writes", async () => {
  const { db, run } = database();
  run.checkpoint = { ...newCheckpoint(), phase: "applying", ids: ["family-1"] };
  mocks.load.mockImplementation(() => {
    run.cancel_requested_at = new Date(clock).toISOString();
    return Promise.resolve(raw);
  });
  await workSync(run.id, db);
  expect(run.status).toBe("cancelled");
  expect(run.summary.updated).toBe(0);
  expect(mocks.apply).not.toHaveBeenCalled();
  expect(mocks.retire).not.toHaveBeenCalled();
});

test("a provider timeout persists a terminal error and leaves retirement untouched", async () => {
  const { db, run } = database();
  run.checkpoint = { ...newCheckpoint(), phase: "applying", ids: ["family-1"] };
  mocks.load.mockRejectedValue(new Error("lightspeed_request_timeout"));
  await workSync(run.id, db);
  expect(run.status).toBe("failed");
  expect(run.summary.error).toContain("30 seconds");
  expect(run.checkpoint.index).toBe(0);
  expect(mocks.retire).not.toHaveBeenCalled();
});
