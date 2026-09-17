import Link from "next/link";

import type { Category, Condition } from "@/types/domain/product";

import { getInventoryProducts } from "./actions";

const PAGE_SIZE = 100;
type StockStatus = "in_stock" | "out_of_stock" | "archived" | "all";

interface InventoryPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    condition?: string;
    stockStatus?: string;
    page?: string;
  }>;
}

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const stockStatus = (
    ["in_stock", "out_of_stock", "archived", "all"].includes(params.stockStatus ?? "")
      ? params.stockStatus
      : "in_stock"
  ) as StockStatus;
  const filters = {
    q: params.q?.trim() || undefined,
    category: (params.category as Category | "all") || "all",
    condition: (params.condition as Condition | "all") || "all",
    stockStatus,
    page,
  };
  const result = await getInventoryProducts(filters);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams();
    if (filters.q) query.set("q", filters.q);
    if (filters.category !== "all") query.set("category", String(filters.category));
    if (filters.condition !== "all") query.set("condition", String(filters.condition));
    if (filters.stockStatus !== "in_stock") query.set("stockStatus", filters.stockStatus);
    if (nextPage > 1) query.set("page", String(nextPage));
    const suffix = query.toString();
    return `/admin/inventory${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Inventory</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Read-only catalog. Product and stock changes come from Lightspeed.
          </p>
        </div>
        <a
          href={`/api/admin/products/export?${new URLSearchParams({
            ...(filters.q ? { q: filters.q } : {}),
            ...(filters.category !== "all" ? { category: String(filters.category) } : {}),
            ...(filters.condition !== "all"
              ? { condition: String(filters.condition) }
              : {}),
            stockStatus: filters.stockStatus,
          }).toString()}`}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
        >
          Export CSV
        </a>
      </div>

      <form className="grid gap-3 rounded border border-zinc-800 bg-zinc-900 p-4 md:grid-cols-5">
        <label className="md:col-span-2">
          <span className="sr-only">Search inventory</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Search name, brand, model, or SKU"
            className="w-full rounded border border-zinc-700 bg-black px-3 py-2 text-sm text-white"
          />
        </label>
        <label>
          <span className="sr-only">Category</span>
          <input
            name="category"
            defaultValue={filters.category === "all" ? "" : String(filters.category)}
            placeholder="Category"
            className="w-full rounded border border-zinc-700 bg-black px-3 py-2 text-sm text-white"
          />
        </label>
        <label>
          <span className="sr-only">Condition</span>
          <select
            name="condition"
            defaultValue={String(filters.condition)}
            className="w-full rounded border border-zinc-700 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="all">All conditions</option>
            <option value="new">New</option>
            <option value="used">Pre-owned</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Stock status</span>
          <select
            name="stockStatus"
            defaultValue={filters.stockStatus}
            className="w-full rounded border border-zinc-700 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="archived">Archived</option>
            <option value="all">All products</option>
          </select>
        </label>
        <div className="flex gap-3 md:col-span-5">
          <button
            type="submit"
            className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Apply filters
          </button>
          <Link
            href="/admin/inventory"
            className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:text-white"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Products</p>
          <p className="mt-1 text-2xl font-bold text-white">{result.total}</p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">SKUs</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {result.skuTotal ?? result.total}
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Units</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {result.inventoryUnitTotal ?? 0}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-900">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Variants</th>
              <th className="px-4 py-3">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {result.products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                  No inventory matches these filters.
                </td>
              </tr>
            ) : (
              result.products.map((product) => {
                const stock = product.variants.reduce(
                  (sum, variant) => sum + (variant.stock ?? 0),
                  0,
                );
                return (
                  <tr key={product.id} className="align-top text-zinc-300">
                    <td className="px-4 py-3">
                      <details>
                        <summary className="cursor-pointer font-semibold text-white">
                          {product.name}
                        </summary>
                        <div className="mt-3 space-y-2 text-xs text-zinc-400">
                          <p>ID: {product.id}</p>
                          <p>Brand: {product.brand || "—"}</p>
                          <p>Model: {product.model || "—"}</p>
                          <p>Description: {product.description || "—"}</p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full border border-zinc-800">
                              <thead>
                                <tr>
                                  <th className="px-2 py-1">Size</th>
                                  <th className="px-2 py-1">SKU</th>
                                  <th className="px-2 py-1">Price</th>
                                  <th className="px-2 py-1">Stock</th>
                                </tr>
                              </thead>
                              <tbody>
                                {product.variants.map((variant) => (
                                  <tr
                                    key={variant.id}
                                    className="border-t border-zinc-800"
                                  >
                                    <td className="px-2 py-1">{variant.size_label}</td>
                                    <td className="px-2 py-1">{variant.sku || "—"}</td>
                                    <td className="px-2 py-1">
                                      {formatMoney(variant.sale_price_cents)}
                                    </td>
                                    <td className="px-2 py-1">{variant.stock}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>
                    </td>
                    <td className="px-4 py-3">{product.category || "—"}</td>
                    <td className="px-4 py-3">{product.condition || "—"}</td>
                    <td className="px-4 py-3">{product.variants.length}</td>
                    <td className="px-4 py-3">{stock}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded border border-zinc-700 px-3 py-2 hover:text-white"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded border border-zinc-700 px-3 py-2 hover:text-white"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
