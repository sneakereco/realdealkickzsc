import { beforeEach, expect, test, vi } from "vitest";
import fixture from "../fixtures/lightspeed/manual-reconciliation.json";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  load: vi.fn(),
  start: vi.fn(),
  apply: vi.fn(),
  retire: vi.fn(),
  resolve: vi.fn(),
  fail: vi.fn(),
  finish: vi.fn(),
  stock: vi.fn(),
  admin: vi.fn(),
  adminFrom: vi.fn(),
  store: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  requireAdminApi: mocks.auth,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve({ from: mocks.from }),
}));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseAdminClient: mocks.admin,
}));
vi.mock("@/modules/lightspeed/server", () => ({
  loadLightspeedFamily: mocks.load,
  SupabaseCatalogReconciliationStore: class {
    constructor(db: unknown) {
      mocks.store(db);
    }
    startRun = mocks.start;
    applyFamily = mocks.apply;
    retireMissingFamilies = mocks.retire;
    resolveReview = mocks.resolve;
    recordFailure = mocks.fail;
    finishRun = mocks.finish;
    updateUnavailableStock = mocks.stock;
  },
}));
import { GET, POST } from "@/app/api/admin/lightspeed/reviews/route";
const familyId = "11111111-1111-4111-8111-111111111111";
const variantId = "22222222-2222-4222-8222-222222222222";
const query = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  then(resolve: (value: unknown) => unknown) {
    return Promise.resolve({ error: null }).then(resolve);
  },
};
const request = (corrections: unknown = {}) =>
  new Request("http://localhost/api/admin/lightspeed/reviews", {
    method: "POST",
    body: JSON.stringify({ familyId, corrections }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "admin" },
    profile: { tenant_id: "tenant-1" },
  });
  mocks.from.mockReturnValue(query);
  mocks.admin.mockReturnValue({ from: mocks.adminFrom });
  mocks.adminFrom.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({
    data: { family_id: familyId, corrections: {} },
    error: null,
  });
  const raw = structuredClone(fixture);
  raw.data.id = familyId;
  raw.data.products[0].id = variantId;
  raw.inventory[0].product_id = variantId;
  mocks.load.mockResolvedValue(raw);
  mocks.start.mockResolvedValue("retry-1");
  mocks.apply.mockResolvedValue("created");
  mocks.retire.mockResolvedValue(1);
  mocks.stock.mockResolvedValue(false);
});
test("requires authentication before reading reviews or contacting Lightspeed", async () => {
  mocks.auth.mockRejectedValue(new Error("unauthenticated"));
  await GET(new Request("http://localhost/api/admin/lightspeed/reviews"));
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.load).not.toHaveBeenCalled();
});
test("rejects a family outside the authenticated tenant before contacting Lightspeed", async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  expect((await POST(request())).status).toBe(404);
  expect(query.eq).toHaveBeenCalledWith("tenant_id", "tenant-1");
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.admin).not.toHaveBeenCalled();
});

test("saves corrections and finishes a retry after the browser session is lost", async () => {
  const raw = await mocks.load();
  mocks.load.mockImplementationOnce(() => {
    mocks.from.mockImplementation(() => {
      throw new Error("Session not found");
    });
    return Promise.resolve(raw);
  });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.store).toHaveBeenCalledWith({ from: mocks.adminFrom });
  expect(mocks.adminFrom).toHaveBeenCalledWith("lightspeed_import_reviews");
  expect(mocks.finish).toHaveBeenCalledWith("retry-1", "success", expect.any(Object));
});
test("saves website corrections and imports only the selected family", async () => {
  const corrections = { variants: { [variantId]: { condition: "used", size: "10M" } } };
  expect((await POST(request(corrections))).status).toBe(200);
  expect(query.update).toHaveBeenCalledWith(
    expect.objectContaining({ corrections, updated_by: "admin" }),
  );
  expect(mocks.load).toHaveBeenCalledExactlyOnceWith(familyId);
  expect(mocks.apply).toHaveBeenCalledWith(
    "retry-1",
    "tenant-1",
    [expect.objectContaining({ familyId, condition: "used" })],
    new Set(),
  );
  expect(mocks.retire).not.toHaveBeenCalled();
  expect(mocks.finish).toHaveBeenCalledWith(
    "retry-1",
    "success",
    expect.objectContaining({ scope: "family", created: 1 }),
  );
});
test("exclusion retires only the reviewed family", async () => {
  expect((await POST(request({ exclude: true }))).status).toBe(200);
  expect(mocks.retire).toHaveBeenCalledWith("retry-1", "tenant-1", new Set(), familyId);
  expect(mocks.apply).not.toHaveBeenCalled();
  expect(mocks.load).not.toHaveBeenCalled();
});

test("review retries import zero stock and report that it stays off the storefront", async () => {
  const raw = structuredClone(fixture);
  raw.data.id = familyId;
  raw.data.products[0].id = variantId;
  raw.inventory = [
    { product_id: variantId, current_inventory_level: 0, deleted_at: null },
  ];
  mocks.load.mockResolvedValue(raw);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).message).toContain("Imported");
  expect(mocks.retire).not.toHaveBeenCalled();
  expect(mocks.apply).toHaveBeenCalledWith(
    "retry-1",
    "tenant-1",
    [expect.objectContaining({ variants: [expect.objectContaining({ stock: 0 })] })],
    new Set([variantId]),
  );
  expect(mocks.stock).toHaveBeenCalledWith(
    "tenant-1",
    familyId,
    new Set([variantId]),
    new Set([variantId]),
  );
});
test("keeps corrections after a failed retry and releases the run lock", async () => {
  mocks.apply.mockRejectedValue({ message: "duplicate size" });
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ saved: true, error: "duplicate size" });
  expect(mocks.fail).toHaveBeenCalledWith(
    "retry-1",
    familyId,
    "duplicate size",
    expect.any(Object),
  );
  expect(mocks.finish).toHaveBeenCalledWith(
    "retry-1",
    "failed",
    expect.objectContaining({ failed: 1 }),
  );
});
test("a busy run prevents provider calls and correction writes", async () => {
  mocks.start.mockRejectedValueOnce(
    new Error("lightspeed_reconciliation_already_running"),
  );
  expect((await POST(request())).status).toBe(409);
  expect(mocks.load).not.toHaveBeenCalled();
  expect(query.update).not.toHaveBeenCalled();
});
test("rejects malformed JSON", async () => {
  expect(
    (await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status,
  ).toBe(400);
  expect(mocks.start).not.toHaveBeenCalled();
});
