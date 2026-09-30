import { afterEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), recover: vi.fn(), work: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createSupabaseAdminClient: mocks.db }));
vi.mock("@/modules/lightspeed/sync-jobs", () => ({
  recoverLegacySyncs: mocks.recover,
  workSync: mocks.work,
}));
vi.mock("@/modules/lightspeed/webhook-server", () => ({
  processLightspeedWebhookEvent: vi.fn(),
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
