import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductGrid } from "@/components/store/ProductGrid";
import { ProductDetail } from "@/components/store/ProductDetail";
import ProductDetailPage from "@/app/store/[productId]/page";
import type { ProductWithDetails } from "@/types/domain/product";

vi.mock("@/components/cart/CartProvider", () => ({
  useCart: () => ({ items: [], addItem: vi.fn() }),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: vi.fn() }));
const { getById } = vi.hoisted(() => ({ getById: vi.fn() }));
vi.mock("@/modules/catalog/product-repository", () => ({
  ProductRepository: class {
    getById = getById;
  },
}));

const product: ProductWithDetails = {
  id: "1935b396-da48-829d-8175-6856273da579",
  archived_at: null,
  brand: "Nike",
  category: "sneakers",
  created_at: "2020-01-01",
  updated_at: "2020-01-01",
  product_created_at: "2020-01-01",
  product_updated_at: "2020-01-01",
  description: null,
  excluded_auto_tag_keys: [],
  go_live_at: "2020-01-01",
  is_active: true,
  is_out_of_stock: false,
  model: null,
  shipping_price_cents: null,
  tenant_id: "tenant-a",
  name: "Test sneaker",
  size_type: "shoe",
  condition: "new",
  images: [],
  tags: [],
  variants: [
    { id: "cheap", size_label: "8M", sale_price_cents: 9000, stock: 1 },
    { id: "nine", size_label: "9M", sale_price_cents: 18000, stock: 1 },
    { id: "ten", size_label: "10M", sale_price_cents: 22000, stock: 1 },
    { id: "sold", size_label: "11M", sale_price_cents: 5000, stock: 0 },
  ].map((variant, index) => ({
    ...variant,
    created_at: "2020-01-01",
    updated_at: "2020-01-01",
    product_id: "1935b396-da48-829d-8175-6856273da579",
    tenant_id: "tenant-a",
    sku: `SKU-${variant.id}`,
    sort_order: index,
    unit_cost_cents: 0,
  })),
};

test.each([["10M"], ["9M", "10M"]])(
  "card link carries %j into the rendered detail page",
  async (...sizes) => {
    const html = renderToStaticMarkup(
      <ProductCard product={product} sizeFilters={{ sizeShoe: sizes }} />,
    );
    const href = html.match(/href="([^"]+)"/)![1].replaceAll("&amp;", "&");
    const url = new URL(href, "http://store.test");
    getById.mockResolvedValue(product);
    const detail = renderToStaticMarkup(
      await ProductDetailPage({
        params: Promise.resolve({ productId: product.id }),
        searchParams: Promise.resolve({ sizeShoe: url.searchParams.getAll("sizeShoe") }),
      }),
    );
    expect(detail).toContain(sizes.length === 1 ? "10M - $220.00" : "$180.00–$220.00");
    if (sizes.length > 1) expect(detail).toContain("Choose a size");
    expect(detail).not.toContain("$90.00");
  },
);

test("unfiltered cards show the full available range, excluding sold-out prices", () => {
  const html = renderToStaticMarkup(<ProductCard product={product} />);
  expect(html).toContain("$90.00–$220.00");
  expect(html).toContain("Price varies by size");
  expect(html).not.toContain("From ");
  expect(html).not.toContain("$50.00");
});

test("grid passes size selection through to the card and product link", () => {
  const html = renderToStaticMarkup(
    <ProductGrid
      products={[product]}
      sizeFilters={{ sizeShoe: ["10M"] }}
      storeHref="/store?sizeShoe=10M"
    />,
  );
  expect(html).toContain("$220.00");
  expect(html).toContain("Size 10M");
  expect(html).not.toContain("$90.00");
  const href = html.match(/href="([^"]+)"/)![1].replaceAll("&amp;", "&");
  const url = new URL(href, "http://store.test");
  expect(url.searchParams.getAll("sizeShoe")).toEqual(["10M"]);
  expect(url.searchParams.get("from")).toBe("/store?sizeShoe=10M");
});

test("two matching sizes show a range and each exact price", () => {
  const html = renderToStaticMarkup(
    <ProductCard product={product} sizeFilters={{ sizeShoe: ["9M", "10M"] }} />,
  );
  expect(html).toContain("$180.00–$220.00");
  expect(html).toContain("9M · $180.00");
  expect(html).toContain("10M · $220.00");
  expect(html).not.toContain("$90.00");
});

test("same-priced selected sizes show a single price with both sizes", () => {
  const samePrice = {
    ...product,
    variants: product.variants.map((v) => ({ ...v, sale_price_cents: 18000 })),
  };
  const html = renderToStaticMarkup(
    <ProductCard product={samePrice} sizeFilters={{ sizeShoe: ["9M", "10M"] }} />,
  );
  expect(html).toContain("$180.00");
  expect(html).not.toContain("$180.00–");
  expect(html).toContain("Sizes 9M, 10M");
});

test("three matches keep the range compact", () => {
  const html = renderToStaticMarkup(
    <ProductCard product={product} sizeFilters={{ sizeShoe: ["8M", "9M", "10M"] }} />,
  );
  expect(html).toContain("$90.00–$220.00");
  expect(html).toContain("3 matching sizes");
  expect(html).not.toContain("9M ·");
});

test("unavailable selected sizes never fall back to unrelated prices", () => {
  expect(
    renderToStaticMarkup(
      <ProductCard product={product} sizeFilters={{ sizeShoe: ["11M"] }} />,
    ),
  ).toBe("");
  expect(
    renderToStaticMarkup(
      <ProductGrid products={[product]} sizeFilters={{ sizeShoe: ["11M"] }} />,
    ),
  ).toContain("No products found");
  const html = renderToStaticMarkup(
    <ProductCard product={product} sizeFilters={{ sizeShoe: ["10M", "11M"] }} />,
  );
  expect(html).toContain("Size 10M");
  expect(html).toContain("$220.00");
  expect(html).not.toContain("$50.00");
});

test.each([
  ["clothing", "small", { sizeClothing: ["S"] }],
  ["shoe", "11W / 9.5M", { sizeShoe: ["9.5M / 11W"] }],
  ["shoe", "EU 44 (US 11M)", { sizeShoe: ["11M / 12.5W"] }],
] as const)("card prices respect %s aliases for %s", (size_type, size_label, filters) => {
  const item = {
    ...product,
    size_type,
    variants: [{ ...product.variants[1], size_label }, product.variants[0]],
  };
  const html = renderToStaticMarkup(<ProductCard product={item} sizeFilters={filters} />);
  expect(html).toContain("$180.00");
  expect(html).not.toContain("$90.00");
});

test("product details preselect the only matching variant", () => {
  const html = renderToStaticMarkup(
    <ProductDetail product={product} sizeFilters={{ sizeShoe: ["10M"] }} />,
  );
  expect(html).toContain("10M - $220.00");
  expect(html).not.toContain("$90.00");
});

test("product details require a choice for multiple matches instead of selecting the cheapest unrelated size", () => {
  const html = renderToStaticMarkup(
    <ProductDetail product={product} sizeFilters={{ sizeShoe: ["9M", "10M"] }} />,
  );
  expect(html).toContain("$180.00–$220.00");
  expect(html).toContain("Choose a size");
  expect(html).toMatch(/disabled=""[^>]*>Choose a size/);
  expect(html).not.toContain("$90.00");
});

test("stale product links explain unavailable selected sizes without a substitute price", () => {
  const html = renderToStaticMarkup(
    <ProductDetail product={product} sizeFilters={{ sizeShoe: ["11M"] }} />,
  );
  expect(html).toContain("Selected sizes are unavailable");
  expect(html).not.toContain("$90.00");
  expect(html).not.toContain("$0.00");
});
