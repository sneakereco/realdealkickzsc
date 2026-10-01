import { afterEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  recover: vi.fn(),
  work: vi.fn(),
  process: vi.fn(),
}));
vi.mock("@/lib/supabase/service-role", () => ({ createSupabaseAdminClient: mocks.db }));
vi.mock("@/modules/lightspeed/sync-jobs", () => ({
  recoverLegacySyncs: mocks.recover,
  workSync: mocks.work,
}));
vi.mock("@/modules/lightspeed/webhook-server", () => ({
  processLightspeedWebhookEvent: mocks.process,
  webhookRunId: vi.fn(),
}));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));
import { GET } from "@/app/api/cron/lightspeed/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

test.each([undefined, "", "wrong"])(
  "rejects cron calls without the configured secret: %s",
  async (token) => {
    vi.stubEnv("CRON_SECRET", "expected-secret");
    const response = await GET(
      new Request("http://localhost/api/cron/lightspeed", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled();
  },
);
test("fails closed when CRON_SECRET is absent", async () => {
  vi.stubEnv("CRON_SECRET", undefined);
  expect(
    (
      await GET(
        new Request("http://localhost", {
          headers: { authorization: "Bearer undefined" },
        }),
      )
    ).status,
  ).toBe(401);
});

test("a still-leased callback does not starve a newer due retry", async () => {
  vi.stubEnv("CRON_SECRET", "expected-secret");
  const events = [
    {
      id: "active",
      state: "processing",
      lease_until: new Date(Date.now() + 600_000).toISOString(),
    },
    { id: "pending", state: "pending", lease_until: null },
  ];
  mocks.db.mockReturnValue({
    from(table: string) {
      let rows = table === "lightspeed_webhook_events" ? events : [];
      const q = {
        select: () => q,
        eq: () => q,
        not: () => q,
        order: () => q,
        in: () => q,
        lte: () => q,
        or: (filter: string) => {
          if (filter.includes("lease_until.is.null"))
            rows = rows.filter(
              (row) =>
                row.lease_until === null || Date.parse(row.lease_until) <= Date.now(),
            );
          return q;
        },
        limit: (limit: number) => {
          rows = rows.slice(0, limit);
          return q;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(resolve({ data: rows, error: null })),
      };
      return q;
    },
  });
  mocks.process.mockResolvedValue({ state: "succeeded" });
  expect(
    (
      await GET(
        new Request("http://localhost/api/cron/lightspeed", {
          headers: { authorization: "Bearer expected-secret" },
        }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.process).toHaveBeenCalledWith("pending", expect.anything());
  expect(mocks.work).not.toHaveBeenCalled();
});
