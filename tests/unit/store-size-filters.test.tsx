import { createClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { FilterPanel } from "@/components/store/FilterPanel";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { ProductRepository } from "@/modules/catalog/product-repository";
import { StorefrontService } from "@/modules/catalog/storefront";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function variant(id: string, size: string, type = "clothing", stock = 1) {
  return {
    id,
    product_id: id,
    tenant_id: "tenant-1",
    sku: `SKU-${id}`,
    size_label: size,
    stock,
    sale_price_cents: 10000,
    unit_cost_cents: 0,
    product: {
      id,
      tenant_id: "tenant-1",
      name: `Product ${id}`,
      brand: "Brand",
      model: null,
      category: type === "shoe" ? "sneakers" : "clothing",
      size_type: type,
      condition: "new",
      is_active: true,
      is_out_of_stock: false,
      archived_at: null as string | null,
      go_live_at: "2020-01-01T00:00:00Z",
      created_at: "2020-01-01T00:00:00Z",
    },
  };
}

// Exercise the real repository/query builder against capped, filtered HTTP responses.
function catalog(rows: ReturnType<typeof variant>[], failAfterFirstPage = false) {
  const fetch: typeof globalThis.fetch = (input, init) => {
    if (init?.method && !["GET", "HEAD"].includes(init.method))
      throw new Error("Size filtering must be read-only");
    const url = new URL(String(input));
    const params = url.searchParams;
    const offset = Number(params.get("offset") ?? 0);
    if (failAfterFirstPage && offset >= 1000)
      return Promise.resolve(
        Response.json({ message: "page unavailable" }, { status: 500 }),
      );
    const isVariants = url.pathname.endsWith("product_variants");
    const records = isVariants
      ? rows
      : rows.map((v) => ({ ...v.product, variants: [v], images: [], tags: [] }));
    const filtered = records.filter((row) => {
      for (const [key, expression] of params) {
        if (["select", "order", "limit", "offset"].includes(key)) continue;
        const value = key
          .split(".")
          .reduce<unknown>(
            (cursor, part) => (cursor as Record<string, unknown>)?.[part],
            row,
          );
        if (expression.startsWith("eq.") && String(value) !== expression.slice(3))
          return false;
        if (expression === "gt.0" && Number(value) <= 0) return false;
        if (expression === "is.null" && value !== null) return false;
        if (expression.startsWith("lte.") && String(value) > expression.slice(4))
          return false;
        if (expression.startsWith("in.(")) {
          const values = expression
            .slice(4, -1)
            .split(",")
            .map((v) => v.replace(/^"|"$/g, ""));
          if (!values.includes(String(value))) return false;
        }
      }
      return true;
    });
    const data = filtered.slice(
      offset,
      offset + Math.min(1000, Number(params.get("limit") ?? 1000)),
    );
    return Promise.resolve(
      new Response(init?.method === "HEAD" ? null : JSON.stringify(data), {
        headers: {
          "content-type": "application/json",
          "content-range": `${offset}-${offset + data.length - 1}/${filtered.length}`,
        },
      }),
    );
  };
  const db = createClient("http://sizes.test", "test-key", {
    global: { fetch },
    auth: { persistSession: false },
  }) as TypedSupabaseClient;
  return { repo: new ProductRepository(db), store: new StorefrontService(db) };
}

test.each(["newest", "price_asc"] as const)(
  "%s filtering matches clothing aliases without changing raw variants",
  async (sort) => {
    const rows = [
      variant("a", "small"),
      variant("b", "Small"),
      variant("c", "S"),
      variant("d", "SMALL", "clothing", 0),
      variant("e", "medium"),
      variant("f", "small", "shoe"),
    ];
    const result = await catalog(rows).store.listProducts({
      sizeClothing: ["SMALL"],
      sort,
    });
    expect(result.total).toBe(3);
    expect(result.products.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(result.products.flatMap((p) => p.variants.map((v) => v.size_label))).toEqual([
      "small",
      "Small",
      "S",
    ]);
  },
);

test("shoe matching normalizes spacing and token order without guessing conversions", async () => {
  const { store } = catalog([
    variant("a", "11W / 9.5M", "shoe"),
    variant("b", "9.5M / 11 W", "shoe"),
    variant("c", "9.5M / 12W", "shoe"),
    variant("d", "9.5Y / 11W", "shoe"),
  ]);
  const result = await store.listProducts({ sizeShoe: ["9.5M / 11W"] });
  expect(result.products.map((p) => p.id)).toEqual(["a", "b"]);
});

test("existing US selections still include explicitly mapped EU sizes", async () => {
  const result = await catalog([
    variant("a", "EU 44 (US 11M)", "shoe"),
  ]).store.listProducts({ sizeShoe: ["11M / 12.5W"] });
  expect(result.total).toBe(1);
});

test.each(["8C", "42", "One Size"])("uncommon size %s can be filtered", async (size) => {
  const type = size === "8C" ? "shoe" : "clothing";
  const result = await catalog([
    variant("a", size.toLowerCase(), type),
  ]).store.listProducts(
    type === "shoe" ? { sizeShoe: [size] } : { sizeClothing: [size] },
  );
  expect(result.total).toBe(1);
});

test("size options include later pages, normalize aliases, and exclude unavailable listings", async () => {
  const rows = Array.from({ length: 1001 }, (_, n) => variant(String(n), "small"));
  rows.push(variant("last", "xxl"), variant("sold", "4XL", "clothing", 0));
  const archived = variant("archived", "5XL");
  const future = variant("future", "6XL");
  rows.push({
    ...archived,
    product: { ...archived.product, archived_at: "2020-01-01" },
  } as unknown as ReturnType<typeof variant>);
  future.product.go_live_at = "2999-01-01T00:00:00Z";
  rows.push(future);
  const options = await catalog(rows).repo.listAvailableSizes();
  expect(options.clothing).toEqual(["SMALL", "2XL"]);
});

test("size matching reaches products beyond the first thousand variants", async () => {
  const rows = Array.from({ length: 1001 }, (_, n) => variant(String(n), "medium"));
  rows.push(variant("last", "small"));
  const result = await catalog(rows).store.listProducts({ sizeClothing: ["SMALL"] });
  expect(result.products.map((p) => p.id)).toEqual(["last"]);
});

test("later-page errors never silently produce incomplete size options or matches", async () => {
  const rows = Array.from({ length: 1001 }, (_, n) => variant(String(n), "small"));
  const { repo, store } = catalog(rows, true);
  await expect(repo.listAvailableSizes()).rejects.toMatchObject({
    message: "page unavailable",
  });
  await expect(store.listProducts({ sizeClothing: ["SMALL"] })).rejects.toMatchObject({
    message: "page unavailable",
  });
});

test("the panel renders imported uncommon sizes and recognizes selected aliases", () => {
  const html = renderToStaticMarkup(
    <FilterPanel
      selectedCategories={[]}
      selectedBrands={[]}
      selectedModels={[]}
      selectedShoeSizes={["11W / 9.5M"]}
      selectedClothingSizes={["small"]}
      selectedConditions={[]}
      categories={["sneakers", "clothing"]}
      brands={[]}
      modelsByBrand={{}}
      brandsByCategory={{}}
      availableConditions={["new"]}
      availableShoeSizes={["8C", "2Y", "11W / 9.5M", "6W", "44EU", "8.5 / 10W"]}
      availableClothingSizes={["small", "Small", "xxl", "42", "44", "6T", "one size"]}
      totalProducts={10}
    />,
  );
  for (const id of ["8c", "2y", "9.5m-/-11w", "6w", "eu-44", "8.5-/-10w"])
    expect(html).toContain(`data-testid="filter-size-shoe-${id}"`);
  for (const id of ["small", "2xl", "42", "44", "6t", "one-size"])
    expect(html).toContain(`data-testid="filter-size-clothing-${id}"`);
  expect(html.match(/data-testid="filter-size-clothing-small"/g)).toHaveLength(1);
  expect(html).toMatch(/data-testid="filter-size-clothing-small"[^>]*checked=""/);
  expect(html).toMatch(/data-testid="filter-size-shoe-9.5m-\/-11w"[^>]*checked=""/);
});
