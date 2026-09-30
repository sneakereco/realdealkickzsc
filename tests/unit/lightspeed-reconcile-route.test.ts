import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  enqueue: vi.fn(),
  recover: vi.fn(),
  cancel: vi.fn(),
  after: vi.fn(),
  admin: vi.fn(),
  store: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  requireAdminApi: mocks.auth,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve({ from: mocks.from }),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseAdminClient: mocks.admin,
}));
vi.mock("next/server", async (original) => ({
  ...(await original<object>()),
  after: mocks.after,
}));
vi.mock("@/modules/lightspeed/sync-jobs", () => ({
  enqueueSync: mocks.enqueue,
  recoverLegacySyncs: mocks.recover,
  cancelSync: mocks.cancel,
  publicSyncRun: (run: unknown) => run,
  runSyncWorker: vi.fn(),
}));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

import { GET, POST, DELETE } from "@/app/api/admin/lightspeed/reconcile/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "admin" },
    profile: { tenant_id: "tenant-1" },
  });
});

test("returns a running job immediately and schedules work after the response", async () => {
  mocks.enqueue.mockResolvedValue({ id: "run-1", status: "running" });
  const response = await POST();
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ run: { id: "run-1", status: "running" } });
  expect(mocks.enqueue).toHaveBeenCalledWith("tenant-1", "admin");
  expect(mocks.after).toHaveBeenCalledTimes(1);
});

test("does not create a privileged client without admin authorization and a tenant", async () => {
  mocks.auth.mockRejectedValueOnce(new Error("unauthenticated"));
  await POST();
  mocks.auth.mockResolvedValueOnce({ user: { id: "admin" }, profile: {} });
  expect((await POST()).status).toBe(400);
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

test("loads every page of legacy failures scoped to the authenticated tenant and run", async () => {
  const eq = vi.fn().mockReturnThis();
  const range = vi.fn().mockImplementation((start: number) =>
    Promise.resolve({
      data: Array.from({ length: start === 0 ? 1000 : 1 }, (_, i) => ({
        entity_key: `family-${start + i}`,
        failure_reason: "includes.tags: missing",
      })),
      error: null,
    }),
  );
  const query = {
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    eq,
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range,
    maybeSingle: () =>
      Promise.resolve({
        data: {
          id: "run-1",
          status: "partial_failure",
          summary: { failed: 1001, created: 0, updated: 0, skipped: 0 },
        },
        error: null,
      }),
  };
  mocks.from.mockReturnValue(query);
  const response = await GET();
  const payload = await response.json();
  expect(response.status).toBe(200);
  expect(payload.run.status).toBe("failed");
  expect(payload.run.summary.failure_groups).toEqual([
    {
      reason: "includes.tags: missing",
      count: 1001,
      family_ids: ["family-0", "family-1", "family-2"],
    },
  ]);
  expect(eq).toHaveBeenCalledWith("tenant_id", "tenant-1");
  expect(eq).toHaveBeenCalledWith("sync_run_id", "run-1");
  expect(range.mock.calls).toEqual([
    [0, 999],
    [1000, 1999],
  ]);
});

test("rejects duplicate starts without scheduling another worker", async () => {
  mocks.enqueue.mockRejectedValueOnce(
    new Error("lightspeed_reconciliation_already_running"),
  );
  expect((await POST()).status).toBe(409);
  expect(mocks.after).not.toHaveBeenCalled();
});

test("explains missing background-worker configuration without creating a stuck run", async () => {
  mocks.enqueue.mockRejectedValueOnce(new Error("lightspeed_worker_not_configured"));
  const response = await POST();
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain("CRON_SECRET");
  expect(mocks.after).not.toHaveBeenCalled();
});

test("cancellation validates the ID and uses only the authenticated tenant", async () => {
  const runId = "00000000-0000-4000-8000-000000000001";
  mocks.cancel.mockResolvedValue({
    id: runId,
    status: "running",
    cancel_requested_at: "now",
  });
  const response = await DELETE(
    new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({ runId, tenantId: "attacker" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.cancel).toHaveBeenCalledWith(runId, "tenant-1");
  expect(
    (await DELETE(new Request("http://localhost", { method: "DELETE", body: "invalid" })))
      .status,
  ).toBe(400);
});

test("does not read run errors before authentication", async () => {
  mocks.auth.mockRejectedValue(new Error("unauthenticated"));
  await GET();
  expect(mocks.from).not.toHaveBeenCalled();
});

test("preserves the fatal error when a run stopped before processing every family", async () => {
  mocks.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: () =>
      Promise.resolve({
        error: null,
        data: {
          id: "run-1",
          status: "failed",
          summary: {
            failed: 1,
            error: "Sync stopped. Check the server logs for details.",
            failure_groups: [],
            progress: { phase: "failed", completed: 1, total: 100 },
          },
        },
      }),
  });
  const payload = await (await GET()).json();
  expect(payload.run.summary.error).toBe(
    "Sync stopped. Check the server logs for details.",
  );
});
