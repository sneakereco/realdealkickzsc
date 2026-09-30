import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  reconcile: vi.fn(),
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
vi.mock("@/modules/lightspeed/server", () => ({
  loadLightspeedFamilies: vi.fn(),
  SupabaseCatalogReconciliationStore: class {
    constructor(db: unknown) {
      mocks.store(db);
    }
  },
}));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));
vi.mock("@/modules/lightspeed/reconciliation", async (original) => ({
  ...(await original<object>()),
  reconcileCatalog: mocks.reconcile,
}));

import { GET, POST } from "@/app/api/admin/lightspeed/reconcile/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "admin" },
    profile: { tenant_id: "tenant-1" },
  });
});

test("executes an authorized sync with server credentials independent of session loss", async () => {
  const db = { from: vi.fn() };
  mocks.admin.mockReturnValue(db);
  mocks.reconcile.mockImplementationOnce((options) => {
    mocks.auth.mockRejectedValue(new Error("Session not found"));
    expect(options).toMatchObject({ tenantId: "tenant-1", userId: "admin" });
    return Promise.resolve({ failed: 0, created: 1, updated: 0, skipped: 0 });
  });
  expect((await POST()).status).toBe(200);
  expect(mocks.store).toHaveBeenCalledWith(db);
  expect(mocks.auth).toHaveBeenCalledTimes(1);
});

test("does not create a privileged client without admin authorization and a tenant", async () => {
  mocks.auth.mockRejectedValueOnce(new Error("unauthenticated"));
  await POST();
  mocks.auth.mockResolvedValueOnce({ user: { id: "admin" }, profile: {} });
  expect((await POST()).status).toBe(400);
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.reconcile).not.toHaveBeenCalled();
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

test("returns HTTP 422 when every family failed", async () => {
  mocks.reconcile.mockResolvedValue({
    failed: 2,
    created: 0,
    updated: 0,
    skipped: 0,
    error: "Every family failed",
  });
  const response = await POST();
  expect(response.status).toBe(422);
  expect((await response.json()).error).toBe("Every family failed");
});

test("keeps partial imports distinct from total failure", async () => {
  mocks.reconcile.mockResolvedValue({ failed: 1, created: 1, updated: 0, skipped: 0 });
  expect((await POST()).status).toBe(200);
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
