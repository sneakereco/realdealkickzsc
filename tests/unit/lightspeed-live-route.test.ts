import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ capture: vi.fn(), process: vi.fn(), after: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));
vi.mock("@/modules/lightspeed/webhook-server", () => ({
  captureLightspeedWebhook: mocks.capture,
  processLightspeedWebhookEvent: mocks.process,
  LightspeedWebhookError: class extends Error {
    constructor(public status: number) {
      super("Callback rejected");
    }
  },
}));
import { POST } from "@/app/api/webhooks/lightspeed/route";
import { LightspeedWebhookError } from "@/modules/lightspeed/webhook-server";
afterEach(() => vi.clearAllMocks());

test("acknowledges durable capture before targeted background processing without a browser origin or signature", async () => {
  mocks.capture.mockResolvedValue({
    duplicate: false,
    row: { id: "event", state: "pending", next_attempt_at: new Date(0).toISOString() },
  });
  const request = new Request(
    `https://example.test/api/webhooks/lightspeed?token=${"a".repeat(64)}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "type=product.update",
    },
  );
  expect((await POST(request)).status).toBe(204);
  expect(mocks.capture).toHaveBeenCalledWith({
    rawBody: "type=product.update",
    callbackToken: "a".repeat(64),
    contentType: "application/x-www-form-urlencoded",
  });
  expect(mocks.process).not.toHaveBeenCalled();
  await (mocks.after.mock.calls[0][0] as () => Promise<void>)();
  expect(mocks.process).toHaveBeenCalledWith("event");
});
test("rejects an unauthenticated callback without scheduling work", async () => {
  mocks.capture.mockRejectedValue(
    new LightspeedWebhookError(401, "webhook_token_invalid"),
  );
  expect(
    (
      await POST(
        new Request("https://example.test/api/webhooks/lightspeed", { method: "POST" }),
      )
    ).status,
  ).toBe(401);
  expect(mocks.after).not.toHaveBeenCalled();
});
test("does not reschedule a succeeded duplicate", async () => {
  mocks.capture.mockResolvedValue({
    duplicate: true,
    row: { id: "event", state: "succeeded", next_attempt_at: new Date(0).toISOString() },
  });
  expect(
    (
      await POST(
        new Request("https://example.test/api/webhooks/lightspeed", { method: "POST" }),
      )
    ).status,
  ).toBe(204);
  expect(mocks.after).not.toHaveBeenCalled();
});
