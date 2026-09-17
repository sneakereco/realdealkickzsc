import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import {
  normalizeLightspeedFamily,
  reconcileCatalog,
  type CatalogReconciliationStore,
  type ReconciliationSummary,
} from "@/lib/lightspeed/reconciliation";

const fixturePath = new URL(
  "../fixtures/lightspeed/manual-reconciliation.json",
  import.meta.url,
);

async function fixture() {
  return JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
}

function fakeStore(actions: Array<"created" | "updated" | "skipped">) {
  const completed: Array<{ status: string; summary: ReconciliationSummary }> = [];
  const failures: string[] = [];
  const store: CatalogReconciliationStore = {
    startRun: () => Promise.resolve("run-1"),
    applyFamily: () => Promise.resolve(actions.shift() ?? "skipped"),
    retireMissingFamilies: () => Promise.resolve(1),
    recordFailure: (_runId, key) => {
      failures.push(key);
      return Promise.resolve();
    },
    finishRun: (_runId, status, summary) => {
      completed.push({ status, summary });
      return Promise.resolve();
    },
  };
  return { store, completed, failures };
}

void test("normalizes the checked-in Lightspeed contract fixture", async () => {
  const canonical = normalizeLightspeedFamily(await fixture());

  assert.equal(canonical.familyId, "family-1");
  assert.equal(canonical.brand, "Jordan");
  assert.equal(canonical.category, "sneakers");
  assert.equal(canonical.condition, "new");
  assert.deepEqual(canonical.variants[0], {
    productId: "product-10",
    sku: "RDK-AJ1-BRED-10",
    sizeLabel: "10",
    salePriceCents: 18999,
    unitCostCents: 10000,
    stock: 2,
    active: true,
  });
});

void test("reports create, update, unchanged, retire, and malformed families independently", async () => {
  const valid = await fixture();
  const { store, completed, failures } = fakeStore(["created", "updated", "skipped"]);

  const summary = await reconcileCatalog({
    tenantId: "tenant-1",
    userId: "user-1",
    loadFamilies: () => Promise.resolve([valid, valid, valid, { bad: true }]),
    store,
  });

  assert.deepEqual(summary, {
    created: 1,
    updated: 1,
    retired: 1,
    skipped: 1,
    failed: 1,
  });
  assert.deepEqual(failures, ["unknown"]);
  assert.equal(completed[0].status, "partial_failure");
});

void test("does not mutate or retire anything when the provider scan fails", async () => {
  const { store, completed } = fakeStore([]);
  let applied = false;
  let retired = false;
  store.applyFamily = () => {
    applied = true;
    return Promise.resolve("created");
  };
  store.retireMissingFamilies = () => {
    retired = true;
    return Promise.resolve(0);
  };

  await assert.rejects(() =>
    reconcileCatalog({
      tenantId: "tenant-1",
      userId: "user-1",
      loadFamilies: () => Promise.reject(new Error("provider unavailable")),
      store,
    }),
  );

  assert.equal(applied, false);
  assert.equal(retired, false);
  assert.equal(completed[0].status, "failed");
});
