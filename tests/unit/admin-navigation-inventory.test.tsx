import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SessionProvider } from "@/contexts/SessionContext";
import type { ProfileRole } from "@/config/constants/roles";
import { Navbar } from "@/components/shell/Navbar";
import { AdminTopbar } from "@/modules/admin/AdminTopbar";
import InventoryPage from "@/app/admin/inventory/page";
import { getInventoryProducts } from "@/app/admin/inventory/actions";

vi.mock("next/navigation", () => ({
  usePathname: () => "/store",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/admin/inventory/actions", () => ({
  getInventoryProducts: vi.fn(),
}));

describe("admin navigation", () => {
  it.each<ProfileRole | null>([
    "admin",
    "super_admin",
    "dev",
    "customer",
    "seller",
    null,
  ])("shows the storefront return link only for staff: %s", (role) => {
    const html = renderToStaticMarkup(
      <SessionProvider
        initialUser={role ? { id: "user", email: "staff@example.com" } : null}
        initialRole={role}
      >
        <Navbar />
      </SessionProvider>,
    );
    expect(html.includes('href="/admin/dashboard"')).toBe(
      role === "admin" || role === "super_admin" || role === "dev",
    );
  });

  it("provides a website link in the admin header", () => {
    const html = renderToStaticMarkup(<AdminTopbar />);
    expect(html).toMatch(/href="\/"[^>]*>.*?View website/s);
  });
});

describe("inventory thumbnails", () => {
  it.each([
    {
      images: [
        { url: "/first.png", is_primary: false },
        { url: "/primary.png", is_primary: true },
      ],
      expected: "/primary.png",
    },
    { images: [{ url: "/first.png", is_primary: false }], expected: "/first.png" },
    { images: [], expected: null },
  ])(
    "renders the primary image, first image, or placeholder: $expected",
    async ({ images, expected }) => {
      vi.mocked(getInventoryProducts).mockResolvedValue({
        products: [
          {
            id: "product",
            name: "Test sneaker",
            variants: [],
            tags: [],
            images: images.map((image, index) => ({
              ...image,
              id: String(index),
              product_id: "product",
              sort_order: index,
            })),
            archived_at: null,
            brand: "Nike",
            category: "sneakers",
            condition: "new",
            created_at: "2026-01-01",
            description: null,
            excluded_auto_tag_keys: [],
            go_live_at: "2026-01-01",
            is_active: true,
            is_out_of_stock: false,
            model: null,
            product_created_at: "2026-01-01",
            product_updated_at: "2026-01-01",
            shipping_price_cents: null,
            size_type: "shoe",
            tenant_id: "tenant",
            updated_at: "2026-01-01",
          },
        ],
        total: 1,
        skuTotal: 0,
        inventoryUnitTotal: 0,
        page: 1,
        limit: 100,
      });
      const html = renderToStaticMarkup(
        await InventoryPage({ searchParams: Promise.resolve({}) }),
      );
      if (expected) {
        expect(decodeURIComponent(html)).toContain(expected);
        expect(html).toContain('alt="Test sneaker"');
      } else {
        expect(html).toContain("No image");
      }
      expect(html).toContain("Test sneaker");
    },
  );
});
