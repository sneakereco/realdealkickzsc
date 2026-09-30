import { expect, test } from "vitest";
import { readSyncResponse } from "@/modules/lightspeed/sync-response";

test("reports platform timeout status instead of a JSON parsing exception", async () => {
  await expect(
    readSyncResponse(new Response("Function timed out", { status: 504 })),
  ).rejects.toThrow("HTTP 504");
});
test("preserves the application's actionable error", async () => {
  await expect(
    readSyncResponse(
      Response.json({ error: "A sync is already running" }, { status: 409 }),
    ),
  ).rejects.toThrow("already running");
});
test("accepts an enqueued run without reporting it completed", async () => {
  expect(
    await readSyncResponse(
      Response.json({ run: { id: "run", status: "running" } }, { status: 202 }),
    ),
  ).toEqual({ run: { id: "run", status: "running" } });
});
