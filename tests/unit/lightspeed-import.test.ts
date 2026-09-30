import { readFile } from "node:fs/promises";
import { afterEach, expect, test, vi } from "vitest";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: {} }));
import { SupabaseCatalogReconciliationStore } from "@/modules/lightspeed/server";
import { normalizeLightspeedFamily } from "@/modules/lightspeed/reconciliation";
import { ProductTitleParserService } from "@/services/product-title-parser-service";
import { parseTitleWithCatalog } from "@/services/product-title-parser";

afterEach(() => vi.restoreAllMocks());

// A stateful database double: exercise real importer/tag helpers over repeated writes.
function database() {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {};
  let sequence = 0;
  function checkSizes() {
    const keys = (tables.product_variants ?? []).map(
      (v) => `${v.product_id}:${v.size_label}`,
    );
    if (new Set(keys).size !== keys.length)
      throw new Error("product_variants_unique_per_size");
  }
  const db = {
    rpc(
      name: string,
      args: {
        p_moves: Array<{ variant_id: string; product_id: string; size_label: string }>;
      },
    ) {
      expect(name).toBe("move_lightspeed_variants");
      for (const move of args.p_moves) {
        Object.assign(tables.product_variants.find((v) => v.id === move.variant_id)!, {
          product_id: move.product_id,
          size_label: move.size_label,
        });
        Object.assign(
          tables.lightspeed_product_links.find((v) => v.variant_id === move.variant_id)!,
          { product_id: move.product_id },
        );
      }
      checkSizes();
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      tables[table] ??= [];
      let operation = "select";
      let values: Row[] = [];
      let single = false;
      let conflict = "";
      const filters: Array<(row: Row) => boolean> = [];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value);
          return query;
        },
        in: (key: string, value: unknown[]) => {
          filters.push((row) => value.includes(row[key]));
          return query;
        },
        order: () => query,
        range: (from: number, to: number) => {
          start = from;
          end = to + 1;
          return query;
        },
        insert: (input: Row | Row[]) => {
          operation = "insert";
          values = Array.isArray(input) ? input : [input];
          return query;
        },
        upsert: (input: Row | Row[], options?: { onConflict?: string }) => {
          operation = "upsert";
          values = Array.isArray(input) ? input : [input];
          conflict = options?.onConflict ?? "";
          return query;
        },
        update: (input: Row) => {
          operation = "update";
          values = [input];
          return query;
        },
        delete: () => {
          operation = "delete";
          return query;
        },
        single: () => {
          single = true;
          return query;
        },
        maybeSingle: () => {
          single = true;
          return query;
        },
        then(resolve: (result: { data: Row[] | Row | null; error: null }) => unknown) {
          let rows = tables[table].filter((row) =>
            filters.every((filter) => filter(row)),
          );
          if (operation === "insert" || operation === "upsert") {
            rows = values.map((value) => {
              const existing =
                operation === "upsert" && conflict
                  ? tables[table].find((row) =>
                      conflict.split(",").every((key) => row[key] === value[key]),
                    )
                  : undefined;
              if (existing) {
                Object.assign(existing, value);
                return existing;
              }
              const row = {
                id: `id-${++sequence}`,
                excluded_auto_tag_keys: [],
                ...value,
              };
              tables[table].push(row);
              return row;
            });
          } else if (operation === "update")
            rows.forEach((row) => Object.assign(row, values[0]));
          else if (operation === "delete")
            tables[table] = tables[table].filter((row) => !rows.includes(row));
          checkSizes();
          const result = rows.slice(start, end).map((row) =>
            table === "product_tags"
              ? { ...row, tag: tables.tags?.find((tag) => tag.id === row.tag_id) }
              : table === "product_images"
                ? {
                    url: row.url,
                    sort_order: row.sort_order,
                    is_primary: row.is_primary,
                  }
                : { ...row },
          );
          return Promise.resolve(
            resolve({ data: single ? (result[0] ?? null) : result, error: null }),
          );
        },
      };
      let start = 0,
        end: number | undefined;
      return query;
    },
  };
  return { db: db as unknown as TypedSupabaseClient, tables };
}

test.each(["10", "11"])(
  "imports untagged conditions and preserves identities through size %s swaps",
  async (usedSize) => {
    vi.spyOn(ProductTitleParserService.prototype, "parseTitle").mockImplementation(
      (input) =>
        Promise.resolve(
          parseTitleWithCatalog(input, {
            brandAliases: [
              {
                brandId: "jordan",
                brandLabel: "Jordan",
                groupKey: "sportswear",
                aliasLabel: "Jordan",
                aliasNormalized: "jordan",
                priority: 1,
              },
            ],
            modelAliasesByBrand: {},
          }),
        ),
    );
    const raw = JSON.parse(
      await readFile(
        new URL("../fixtures/lightspeed/manual-reconciliation.json", import.meta.url),
        "utf8",
      ),
    );
    raw.data.products.push({
      ...raw.data.products[0],
      id: "used-10",
      variant_attributes: ["used", usedSize],
      codes: [{ type: "CUSTOM", code: "USED-10" }],
    });
    raw.inventory.push({ product_id: "used-10", current_inventory_level: 1 });
    const { db, tables } = database();
    const store = new SupabaseCatalogReconciliationStore(db);
    const groups = normalizeLightspeedFamily(raw);
    expect(await store.applyFamily("run-1", "tenant-1", groups)).toBe("created");
    expect(tables.products.map((p) => p.condition).sort()).toEqual(["new", "used"]);
    const identities = tables.lightspeed_product_links.map((link) => [
      link.lightspeed_product_id,
      link.product_id,
      link.variant_id,
    ]);
    for (const product of tables.products) {
      const tags = tables.product_tags
        .filter((link) => link.product_id === product.id)
        .map((link) => tables.tags.find((tag) => tag.id === link.tag_id));
      expect(tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "Jordan", group_key: "brand" }),
          expect.objectContaining({ label: product.condition, group_key: "condition" }),
          expect.objectContaining({
            label: product.condition === "used" ? usedSize : "10",
            group_key: "size_shoe",
          }),
        ]),
      );
      expect(
        tables.product_variants.filter((v) => v.product_id === product.id),
      ).toHaveLength(1);
    }
    expect(await store.applyFamily("run-2", "tenant-1", groups)).toBe("skipped");
    expect(tables.products).toHaveLength(2);
    expect(tables.product_variants).toHaveLength(2);
    expect(
      tables.lightspeed_product_links.map((link) => [
        link.lightspeed_product_id,
        link.product_id,
        link.variant_id,
      ]),
    ).toEqual(identities);
    raw.data.products[0].variant_attributes[0] = "used";
    raw.data.products[1].variant_attributes[0] = "new";
    await store.applyFamily("swap", "tenant-1", normalizeLightspeedFamily(raw));
    expect(tables.products).toHaveLength(2);
    for (const link of tables.lightspeed_product_links) {
      const original = identities.find((item) => item[0] === link.lightspeed_product_id)!;
      expect(link.variant_id).toBe(original[2]);
      expect(link.product_id).not.toBe(original[1]);
    }
    expect(
      await store.applyFamily("swap-repeat", "tenant-1", normalizeLightspeedFamily(raw)),
    ).toBe("skipped");
    raw.data.products[0].variant_attributes[0] = "new";
    raw.data.products[1].variant_attributes[0] = "used";
    await store.applyFamily("swap-back", "tenant-1", normalizeLightspeedFamily(raw));
    raw.data.products[1].deleted_at = "2026-09-29T00:00:00Z";
    raw.data.products[1].codes = null;
    raw.inventory.pop();
    await store.applyFamily("run-3", "tenant-1", normalizeLightspeedFamily(raw));
    expect(tables.products.find((p) => p.condition === "used")?.is_active).toBe(false);
    expect(tables.product_variants.find((v) => v.sku === "USED-10")?.stock).toBe(0);
    expect(tables.product_variants.find((v) => v.sku === "RDK-AJ1-BRED-10")?.stock).toBe(
      2,
    );
    raw.data.products[0].variant_attributes[0] = "used";
    await store.applyFamily(
      "replace-retired",
      "tenant-1",
      normalizeLightspeedFamily(raw),
    );
    expect(tables.products.filter((p) => p.is_active)).toHaveLength(1);
    expect(tables.products.find((p) => p.is_active)?.condition).toBe("used");
    expect(
      await store.applyFamily(
        "replace-repeat",
        "tenant-1",
        normalizeLightspeedFamily(raw),
      ),
    ).toBe("skipped");
  },
);
