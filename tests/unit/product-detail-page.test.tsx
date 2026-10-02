import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

import ProductDetailPage, { generateMetadata } from "@/app/store/[productId]/page";

const { getById } = vi.hoisted(() => ({ getById: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: vi.fn() }));
vi.mock("@/modules/catalog/product-repository", () => ({
  ProductRepository: class {
    getById = getById;
  },
}));
vi.mock("@/components/store/ProductDetail", () => ({
  ProductDetail: ({ product }: { product: { name: string } }) => <h1>{product.name}</h1>,
}));
vi.mock("@/components/store/BackToStoreLink", () => ({ BackToStoreLink: () => null }));

beforeEach(() => {
  getById.mockReset().mockResolvedValue({
    name: "Abominable Bombernaut Tee",
    condition: "new",
    description: null,
    images: [],
    variants: [{ sale_price_cents: 15000, stock: 1 }],
  });
});

it.each(["1935b396-da48-829d-8175-6856273da579", "1935b396-da48-429d-8175-6856273da579"])(
  "renders product details and metadata for UUID %s",
  async (productId) => {
    const props = { params: Promise.resolve({ productId }) };
    expect(renderToStaticMarkup(await ProductDetailPage(props))).toContain(
      "Abominable Bombernaut Tee",
    );
    expect((await generateMetadata(props)).title).toBe(
      "Abominable Bombernaut Tee | Realdealkickzsc",
    );
    expect(getById).toHaveBeenCalledWith(productId);
  },
);

it.each(["not-a-uuid", "1935b396-da48-829d-0175-6856273da579"])(
  "rejects invalid ID %s before querying",
  async (productId) => {
    const props = { params: Promise.resolve({ productId }) };
    await expect(ProductDetailPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect((await generateMetadata(props)).title).toBe("Product Not Found");
    expect(getById).not.toHaveBeenCalled();
  },
);

it("keeps missing products unavailable", async () => {
  getById.mockResolvedValue(null);
  const props = {
    params: Promise.resolve({ productId: "1935b396-da48-829d-8175-6856273da579" }),
  };
  await expect(ProductDetailPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
  expect((await generateMetadata(props)).title).toBe("Product Not Found");
});
