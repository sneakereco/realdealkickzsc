import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test, expect, vi } from "vitest";
import { logError } from "@/lib/utils/log";
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

import {
  normalizeLightspeedFamily,
  describeLightspeedFamily,
  groupFailures,
  reconcileCatalog,
  type CatalogReconciliationStore,
  type ReconciliationSummary,
} from "@/modules/lightspeed/reconciliation";

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
  const progress: ReconciliationSummary[] = [];
  const store: CatalogReconciliationStore = {
    startRun: () => Promise.resolve("run-1"),
    updateProgress: (_runId, summary) => {
      progress.push(structuredClone(summary));
      return Promise.resolve();
    },
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
  return { store, completed, failures, progress };
}

void test("normalizes the checked-in Lightspeed contract fixture", async () => {
  const [canonical] = normalizeLightspeedFamily(await fixture());

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

test("splits equal sizes into new and used listings without Lightspeed tags", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.products.push({
    ...raw.data.products[0],
    id: "product-used",
    variant_attributes: ["used", "10"],
    codes: [{ type: "CUSTOM", code: "USED-10" }],
  });
  raw.inventory.push({ product_id: "product-used", current_inventory_level: 1 });
  const groups = normalizeLightspeedFamily(raw);
  expect(
    groups.map((group) => ({
      condition: group.condition,
      ids: group.variants.map((variant) => variant.productId),
    })),
  ).toEqual([
    { condition: "new", ids: ["product-10"] },
    { condition: "used", ids: ["product-used"] },
  ]);
});

test("reports missing SKU and condition as actionable mapping errors", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.products[0].codes = null;
  expect(() => normalizeLightspeedFamily(raw)).toThrow("product_custom_code_count");
  raw.data.products[0].codes = [{ type: "CUSTOM", code: "SKU" }];
  raw.data.products[0].variant_attributes = null;
  expect(() => normalizeLightspeedFamily(raw)).toThrow("mapping_required:condition");
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

  expect(summary).toMatchObject({
    created: 1,
    updated: 1,
    retired: 1,
    skipped: 1,
    failed: 1,
  });
  assert.deepEqual(failures, ["unknown"]);
  assert.equal(completed[0].status, "partial_failure");
});

test("persists download and apply progress before completing", async () => {
  const valid = await fixture();
  const { store, progress } = fakeStore(["created"]);
  const summary = await reconcileCatalog({
    tenantId: "tenant-1",
    userId: "user-1",
    store,
    loadFamilies: async (report) => {
      await report({ phase: "downloading", completed: 0, total: 1 });
      await report({ phase: "downloading", completed: 1, total: 1 });
      return [valid];
    },
  });
  expect(progress.map((entry) => entry.progress?.phase)).toEqual([
    "listing",
    "downloading",
    "downloading",
    "applying",
    "applying",
    "retiring",
  ]);
  expect(progress.find((entry) => entry.created === 1)?.progress).toMatchObject({
    phase: "applying",
    completed: 1,
    total: 1,
    updated_at: expect.any(String),
  });
  expect(summary.progress?.phase).toBe("completed");
});

test("persists a timeout failure without applying or retiring the catalog", async () => {
  const { store, completed } = fakeStore([]);
  store.applyFamily = () => {
    throw new Error("must not apply");
  };
  store.retireMissingFamilies = () => {
    throw new Error("must not retire");
  };
  await expect(
    reconcileCatalog({
      tenantId: "tenant-1",
      userId: null,
      store,
      loadFamilies: () => Promise.reject(new Error("lightspeed_request_timeout")),
    }),
  ).rejects.toThrow("lightspeed_request_timeout");
  expect(completed[0]).toMatchObject({
    status: "failed",
    summary: {
      progress: { phase: "failed" },
      error: "Lightspeed did not respond within 30 seconds. Try again.",
    },
  });
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

test("marks all-item failures as failed, preserves validation details, and logs grouped errors", async () => {
  vi.mocked(logError).mockClear();
  const { store, completed } = fakeStore([]);
  const input = { data: { id: "family-1", products: [{}] } };
  const reasons: string[] = [];
  store.recordFailure = (_run, _key, reason) => {
    reasons.push(reason);
    return Promise.resolve();
  };
  const summary = await reconcileCatalog({
    tenantId: "tenant-1",
    userId: null,
    store,
    loadFamilies: () =>
      Promise.resolve([input, { data: { id: "family-2", products: [{}] } }]),
  });
  expect(completed[0].status).toBe("failed");
  expect(summary.progress?.phase).toBe("failed");
  expect(reasons[0]).toContain("data.name:");
  expect(reasons[0]).toContain("inventory:");
  expect(reasons[0].length).toBeGreaterThan(300);
  expect(summary.failure_groups).toEqual([
    { reason: reasons[0], count: 2, family_ids: ["family-1", "family-2"] },
  ]);
  expect(logError).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      runId: "run-1",
      failed: 2,
      failure_groups: summary.failure_groups,
    }),
  );
});

test("groups existing saved JSON errors into readable reasons with bounded examples", () => {
  const reason = JSON.stringify([
    { path: ["includes", "tags"], message: "Expected array" },
  ]);
  expect(
    groupFailures(
      Array.from({ length: 5 }, (_, i) => ({
        entity_key: `family-${i}`,
        failure_reason: reason,
      })),
    ),
  ).toEqual([
    {
      reason: "includes.tags: Expected array",
      count: 5,
      family_ids: ["family-0", "family-1", "family-2"],
    },
  ]);
});

test("logs collected item failures even when retirement aborts the run", async () => {
  vi.mocked(logError).mockClear();
  const { store } = fakeStore([]);
  store.retireMissingFamilies = () => Promise.reject(new Error("database unavailable"));
  await expect(
    reconcileCatalog({
      tenantId: "tenant-1",
      userId: null,
      store,
      loadFamilies: () => Promise.resolve([{ data: { id: "family-1" } }]),
    }),
  ).rejects.toThrow("database unavailable");
  expect(logError).toHaveBeenCalledTimes(1);
  expect(logError).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      failed: 1,
      failure_groups: expect.arrayContaining([
        expect.objectContaining({ family_ids: ["family-1"] }),
      ]),
    }),
  );
});

test.each(["preowned", "PRE-OWNED", "Preowned", "PREOWNED", " pre owned "])(
  "maps condition %s to used",
  async (condition) => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    raw.data.products[0].variant_attributes[0] = condition;
    expect(normalizeLightspeedFamily(raw)[0].condition).toBe("used");
  },
);

test("ignores deleted incomplete variants and accepts the native SKU field", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.products.unshift({
    id: "deleted",
    deleted_at: "2026-06-01T00:00:00Z",
    codes: null,
  });
  raw.data.products[1].sku = " NATIVE-SKU ";
  raw.data.products[1].codes = null;
  const [family] = normalizeLightspeedFamily(raw);
  expect(family.variants).toHaveLength(1);
  expect(family.variants[0].sku).toBe("NATIVE-SKU");
});

test.each(["Accessories", "Electronics"])(
  "allows condition-only %s without a size",
  async (category) => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    raw.includes.categories[0].name = category;
    raw.data.variant_attribute_ids = ["attribute-condition"];
    raw.data.products[0].variant_attributes = ["new"];
    expect(normalizeLightspeedFamily(raw)[0]).toMatchObject({
      sizeType: "none",
      variants: [expect.objectContaining({ sizeLabel: "One Size" })],
    });
  },
);

test.each(["Sneakers", "Clothing"])("still requires a size for %s", async (category) => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.includes.categories[0].name = category;
  raw.data.variant_attribute_ids = ["attribute-condition"];
  expect(() => normalizeLightspeedFamily(raw)).toThrow(
    "mapping_required:variant_attribute:size",
  );
});

test("does not collapse colour variants or guess open-box condition", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.includes.categories[0].name = "Accessories";
  raw.includes.variant_attributes[1].name = "Colour";
  expect(() => normalizeLightspeedFamily(raw)).toThrow(
    "mapping_required:variant_attribute",
  );
  raw.data.variant_attribute_ids = ["attribute-condition"];
  raw.data.products[0].variant_attributes = ["new opened"];
  expect(() => normalizeLightspeedFamily(raw)).toThrow("mapping_required:condition");
});

test("retires a known family when all provider variants are deleted", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.products = [{ id: "product-10", deleted_at: "2026-09-29T00:00:00Z" }];
  raw.data.category_id = null;
  const { store } = fakeStore([]);
  const apply = vi.spyOn(store, "applyFamily");
  store.retireMissingFamilies = (_run, _tenant, seen) => {
    expect(seen.has("family-1")).toBe(false);
    return Promise.resolve(1);
  };
  const result = await reconcileCatalog({
    tenantId: "tenant-1",
    userId: null,
    store,
    loadFamilies: () => Promise.resolve([raw]),
  });
  expect(apply).not.toHaveBeenCalled();
  expect(result).toMatchObject({ failed: 0, retired: 1 });
});

test.each([
  ["d6d7ff9a-1238-49ce-afcf-8a07f82ac431", "sneakers"],
  ["2ba80365-94a2-47f8-a57e-8fe31d2cf851", "clothing"],
])(
  "uses approved website category for family %s even after a rename",
  async (id, category) => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    raw.data.id = id;
    raw.data.name = "Renamed product";
    raw.data.category_id = null;
    raw.includes.categories = [];
    expect(normalizeLightspeedFamily(raw)[0].category).toBe(category);
  },
);

test("keeps an explicit Lightspeed category ahead of a website fallback", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.id = "d6d7ff9a-1238-49ce-afcf-8a07f82ac431";
  raw.includes.categories[0].name = "Clothing";
  expect(normalizeLightspeedFamily(raw)[0].category).toBe("clothing");
});

test("leaves unapproved families flagged instead of guessing from their names", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.id = "5635e4f8-01b2-4276-9fb4-7295f8e2e7cc";
  raw.data.category_id = null;
  expect(() => normalizeLightspeedFamily(raw)).toThrow("mapping_required:category");
});

test("skips the approved discount service without requiring stock or condition", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.id = "b26a727f-4244-11f1-b750-020b2c2a4661";
  raw.data.category_id = null;
  raw.data.products[0].variant_attributes = null;
  raw.inventory = [];
  expect(normalizeLightspeedFamily(raw)).toEqual([]);
});

test("applies website review corrections for missing category, condition and size", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.category_id = null;
  raw.data.classification = "STANDARD";
  raw.data.variant_attribute_ids = null;
  raw.data.products[0].variant_attributes = null;
  const corrected = normalizeLightspeedFamily(raw, {
    category: "sneakers",
    variants: { "product-10": { condition: "used", size: "10M / 11.5W" } },
  });
  expect(corrected[0]).toMatchObject({
    category: "sneakers",
    condition: "used",
    sizeType: "shoe",
  });
  expect(corrected[0].variants[0].sizeLabel).toBe("10M / 11.5W");
  expect(raw.data.products[0].variant_attributes).toBeNull();
});

test("a website exclusion skips a family without guessing its fields", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.category_id = null;
  expect(normalizeLightspeedFamily(raw, { exclude: true })).toEqual([]);
  expect(normalizeLightspeedFamily({data:{id:"deleted"}}, { exclude: true })).toEqual([]);
});

test("review exposes all missing fields and preserves colour distinctions", async () => {
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));
  raw.data.category_id = null;
  raw.data.variant_attribute_ids = ["colour"];
  raw.includes.variant_attributes = [{id:"colour",name:"Colour",deleted_at:null}];
  raw.data.products[0].variant_attributes = ["Green"];
  const view = describeLightspeedFamily(raw);
  expect(view.variants[0].issues).toEqual(["Choose a category", "Choose a condition", "Enter a size or variant label"]);
  expect(view.variants[0].providerValues).toBe("Colour: Green");
  const normalized = normalizeLightspeedFamily(raw, {category:"accessories",variants:{"product-10":{condition:"new",size:"One Size — Green"}}});
  expect(normalized[0].variants[0].sizeLabel).toBe("One Size — Green");
});
