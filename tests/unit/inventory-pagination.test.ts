import { createClient } from "@supabase/supabase-js";
import { expect, test } from "vitest";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { ProductRepository } from "@/modules/catalog/product-repository";

// Real query builder against an HTTP boundary with PostgREST's 1,000-row cap.
function repository(failAfterFirstPage = false) {
  const variants = Array.from({ length: 1006 }, (_, index) => {
    const id = String(index).padStart(5, "0");
    return {
      id,
      product_id: id,
      tenant_id: "tenant-1",
      sku: `SKU-${id}`,
      size_label: "10",
      stock: index === 1005 ? 0 : 2,
      sale_price_cents: 20000,
      unit_cost_cents: 0,
      product: {
        id,
        tenant_id: "tenant-1",
        name: "Jordan shoe",
        brand: "Jordan",
        model: "shoe",
        category: "sneakers",
        condition: "new",
        is_active: true,
        is_out_of_stock: index === 1005,
        archived_at: null,
        go_live_at: "2020-01-01T00:00:00Z",
        created_at: "2020-01-01T00:00:00Z",
      },
    };
  });
  const fetch: typeof globalThis.fetch = (input) => {
    const url = new URL(String(input));
    const params = url.searchParams;
    const offset = Number(params.get("offset") ?? 0);
    if (failAfterFirstPage && offset >= 1000)
      return Promise.resolve(
        Response.json({ message: "page unavailable" }, { status: 500 }),
      );
    const isVariants = url.pathname.endsWith("product_variants");
    let filtered = variants.filter((v) => {
      const prefix = isVariants ? "product." : "";
      const stockStatus = params.get(`${prefix}is_out_of_stock`);
      if (stockStatus && v.product.is_out_of_stock !== (stockStatus === "eq.true"))
        return false;
      if (params.get("stock") === "gt.0" && v.stock <= 0) return false;
      if (params.get("stock") === "lte.0" && v.stock > 0) return false;
      const ids = params.get("id");
      if (ids && !ids.slice(4, -1).split(",").includes(v.product.id)) return false;
      return true;
    });
    const count = filtered.length;
    filtered = filtered.slice(
      offset,
      offset + Math.min(1000, Number(params.get("limit") ?? 1000)),
    );
    const data = isVariants
      ? filtered
      : filtered.map((v) => ({
          ...v.product,
          variants: [v],
          images: [],
          tags: [],
        }));
    return Promise.resolve(
      Response.json(data, {
        headers: { "content-range": `${offset}-${offset + data.length - 1}/${count}` },
      }),
    );
  };
  return new ProductRepository(
    createClient("http://inventory.test", "test-key", {
      global: { fetch },
      auth: { persistSession: false },
    }) as TypedSupabaseClient,
  );
}

const filters = {
  tenantId: "tenant-1",
  searchMode: "inventory" as const,
  includeOutOfStock: true,
};

test("exports every matching SKU past the API cap and preserves the stock filter", async () => {
  const repo = repository();
  const rows = await repo.exportInventoryRows({ ...filters, stockStatus: "in_stock" });
  expect(rows).toHaveLength(1005);
  expect(new Set(rows.map((r) => r.sku)).size).toBe(1005);
  expect(rows.at(-1)).toMatchObject({ sku: "SKU-01004", stock: 2 });
  const all = await repo.exportInventoryRows({ ...filters, stockStatus: "all" });
  expect(all).toHaveLength(1006);
  expect(all.at(-1)?.stock).toBe(0);
});

test("inventory totals cover all pages and in-stock excludes sold-out products", async () => {
  const repo = repository();
  const result = await repo.list({
    ...filters,
    stockStatus: "in_stock",
    page: 11,
    limit: 100,
  });
  expect(result).toMatchObject({ total: 1005, skuTotal: 1005, inventoryUnitTotal: 2010 });
  expect(result.products).toHaveLength(5);
  const soldOut = await repo.list({ ...filters, stockStatus: "out_of_stock" });
  expect(soldOut).toMatchObject({ total: 1, skuTotal: 1, inventoryUnitTotal: 0 });
  const all = await repo.list({ ...filters, stockStatus: "all" });
  expect(all).toMatchObject({ total: 1006, skuTotal: 1006, inventoryUnitTotal: 2010 });
});

test("inventory search can reach matches beyond the first thousand", async () => {
  const result = await repository().list({
    ...filters,
    stockStatus: "in_stock",
    q: "Jordan",
    page: 11,
    limit: 100,
  });
  expect(result.total).toBe(1005);
  expect(result.products).toHaveLength(5);
});

test("a later-page failure rejects exports and totals instead of reporting partial success", async () => {
  await expect(
    repository(true).exportInventoryRows({ ...filters, stockStatus: "all" }),
  ).rejects.toMatchObject({ message: "page unavailable" });
  await expect(
    repository(true).list({ ...filters, stockStatus: "all" }),
  ).rejects.toMatchObject({ message: "page unavailable" });
});

test("the storefront excludes sold-out products while admin all-products retains them", async () => {
  const result = await repository().list({ tenantId: "tenant-1", limit: 100, page: 11 });
  expect(result.total).toBe(1005);
  expect(result.products).toHaveLength(5);
  expect(result.products.every((p) => !p.is_out_of_stock)).toBe(true);
});
