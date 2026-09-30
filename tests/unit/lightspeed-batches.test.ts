import { expect, test } from "vitest";
import {
  advanceSync,
  newCheckpoint,
  newSummary,
  type SyncCheckpoint,
} from "@/modules/lightspeed/batches";

function harness() {
  const catalog = new Set(["old"]);
  const io = {
    list: (cursor: number) =>
      Promise.resolve(
        cursor === 0
          ? { ids: ["a", "b", "a"], cursor: 20, count: 3 }
          : { ids: [], cursor: 20, count: 0 },
      ),
    apply: (id: string) => {
      catalog.add(id);
      return Promise.resolve(true);
    },
    nextLinked: (after: string | null) =>
      Promise.resolve(
        ["a", "b", "old"].find((id) => after === null || id > after) ?? null,
      ),
    retire: (id: string) => {
      catalog.delete(id);
      return Promise.resolve(1);
    },
  };
  return { io, catalog };
}

test("resumes serialized checkpoints without retiring before the complete listing and import", async () => {
  const { io, catalog } = harness();
  let checkpoint = newCheckpoint();
  const summary = newSummary();
  for (let i = 0; i < 4; i++) {
    await advanceSync(checkpoint, summary, io);
    checkpoint = JSON.parse(JSON.stringify(checkpoint));
    expect(catalog.has("old")).toBe(true);
  }
  expect([...catalog].sort()).toEqual(["a", "b", "old"]);
  while (checkpoint.phase !== "done") await advanceSync(checkpoint, summary, io);
  expect([...catalog].sort()).toEqual(["a", "b"]);
  expect(summary.retired).toBe(1);
});

test("failed downloads leave the checkpoint unchanged for a later retry", async () => {
  const { io, catalog } = harness();
  const checkpoint: SyncCheckpoint = {
    ...newCheckpoint(),
    phase: "applying",
    ids: ["a", "b"],
  };
  io.apply = () => Promise.reject(new Error("lightspeed_request_timeout"));
  await expect(advanceSync(checkpoint, newSummary(), io)).rejects.toThrow("timeout");
  expect(checkpoint.index).toBe(0);
  expect([...catalog]).toEqual(["old"]);
});

test("explicit exclusions retire only after every listed family has been considered", async () => {
  const { io, catalog } = harness();
  catalog.add("a");
  io.apply = (id) => Promise.resolve(id !== "a");
  const checkpoint: SyncCheckpoint = {
    ...newCheckpoint(),
    phase: "applying",
    ids: ["a", "b"],
  };
  const summary = newSummary();
  await advanceSync(checkpoint, summary, io);
  expect(catalog.has("a")).toBe(true);
  while (checkpoint.phase !== "done") await advanceSync(checkpoint, summary, io);
  expect(catalog.has("a")).toBe(false);
});

test("rejects a nonadvancing provider cursor before applying or retiring", async () => {
  const { io, catalog } = harness();
  io.list = () => Promise.resolve({ ids: ["a"], count: 1, cursor: 0 });
  await expect(advanceSync(newCheckpoint(), newSummary(), io)).rejects.toThrow("cursor");
  expect([...catalog]).toEqual(["old"]);
});
