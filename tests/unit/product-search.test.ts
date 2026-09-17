import assert from "node:assert/strict";
import { test } from "vitest";

import { buildSearchTerms, rankSearchCandidates } from "@/lib/search/product-search";

const catalog = [
  {
    id: "retro-high",
    brand: "Nike",
    name: "Air Jordan 1 Retro High",
    model: "Air Jordan 1",
    skus: ["AJ1-RED-10"],
  },
  {
    id: "mid",
    brand: "Jordan",
    name: "Air Jordan 1 Mid",
    model: "Air Jordan 1 Mid",
    skus: ["554724-092"],
  },
  {
    id: "shirt",
    brand: "Jordan",
    name: "Jordan Air T-Shirt",
    model: "Flight Essentials",
    skus: ["TEE-AIR-1"],
  },
];

void test("normalizes whitespace, punctuation, case, and plural query terms", () => {
  assert.deepEqual(buildSearchTerms("  AIR-JORDANS   1  "), [
    "air jordans 1",
    "air",
    "jordans",
    "jordan",
  ]);
});

void test("ranks exact and prefix brand, name, model, and SKU matches predictably", () => {
  assert.deepEqual(
    rankSearchCandidates(catalog, "air jordan 1").map(({ id }) => id),
    ["retro-high", "mid", "shirt"],
  );
  assert.equal(rankSearchCandidates(catalog, "AJ1-RED-10")[0]?.id, "retro-high");
  assert.equal(rankSearchCandidates(catalog, "nike")[0]?.id, "retro-high");
});

void test("uses deterministic IDs for ties and supports stable pagination", () => {
  const tied = [
    { id: "b", brand: "Nike", name: "Dunk Low", model: null, skus: [] },
    { id: "a", brand: "Nike", name: "Dunk High", model: null, skus: [] },
  ];

  const ranked = rankSearchCandidates(tied, "nike");
  assert.deepEqual(
    ranked.map(({ id }) => id),
    ["a", "b"],
  );
  assert.equal(ranked.slice(1, 2)[0]?.id, "b");
  assert.deepEqual(rankSearchCandidates(tied, "no result"), []);
});

void test("ranks a production-like 5,000-product catalog without material latency", () => {
  const products = Array.from({ length: 5_000 }, (_, index) => ({
    id: String(index).padStart(5, "0"),
    brand: index === 4_999 ? "Nike" : "Generic",
    name: index === 4_999 ? "Air Jordan 1 Retro High" : `Runner ${index}`,
    model: index === 4_999 ? "Air Jordan 1" : null,
    skus: [index === 4_999 ? "AJ1-RED-10" : `SKU-${index}`],
  }));
  const startedAt = performance.now();
  const ranked = rankSearchCandidates(products, "air-jordan 1");
  const elapsedMs = performance.now() - startedAt;

  assert.equal(ranked[0]?.id, "04999");
  assert.ok(elapsedMs < 1_000, `ranking took ${elapsedMs.toFixed(1)}ms`);
});
