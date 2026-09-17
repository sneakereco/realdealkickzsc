// app/store/page.tsx
// OPTIMIZED VERSION - Page navigation with improved filter visuals

import Link from "next/link";

import { FilterPanel } from "@/components/store/FilterPanel";
import { ProductGrid } from "@/components/store/ProductGrid";
import { StoreControls } from "@/components/store/StoreControls";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { StorefrontService } from "@/modules/catalog/storefront";
import { storeProductsQuerySchema } from "@/lib/validation/storefront";
import type { ProductFilters } from "@/modules/catalog/product-repository";

// OPTIMIZATION: Enable ISR with longer revalidation
export const revalidate = 60; // Revalidate every 60 seconds

const getArrayParam = (
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) => {
  const value = searchParams?.[key];
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }
  return [];
};

const getStringParam = (
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) => {
  const value = searchParams?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
};

export default async function StorePage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const qParam = getStringParam(resolvedSearchParams, "q");
  const sortParam = getStringParam(resolvedSearchParams, "sort");
  const pageParam = getStringParam(resolvedSearchParams, "page");
  const limitParam = getStringParam(resolvedSearchParams, "limit");

  const pageValue = Number.parseInt(pageParam ?? "", 10);
  const limitValue = Number.parseInt(limitParam ?? "", 10);

  const rawFilters = {
    q: qParam && qParam.trim().length > 0 ? qParam : undefined,
    category: getArrayParam(resolvedSearchParams, "category"),
    brand: getArrayParam(resolvedSearchParams, "brand"),
    model: getArrayParam(resolvedSearchParams, "model"),
    sizeShoe: getArrayParam(resolvedSearchParams, "sizeShoe"),
    sizeClothing: getArrayParam(resolvedSearchParams, "sizeClothing"),
    condition: getArrayParam(resolvedSearchParams, "condition"),
    sort: sortParam && sortParam.trim().length > 0 ? sortParam : "newest",
    page: Number.isFinite(pageValue) ? pageValue : 1,
    limit: Number.isFinite(limitValue) ? limitValue : 20,
  };

  const parsed = storeProductsQuerySchema.safeParse(rawFilters);
  const filters: ProductFilters = parsed.success
    ? parsed.data
    : {
        ...rawFilters,
        sort: "newest",
        page: 1,
        limit: 20,
        includeOutOfStock: false,
      };

  const storeQueryParams = new URLSearchParams();
  if (resolvedSearchParams) {
    Object.entries(resolvedSearchParams).forEach(([key, value]) => {
      if (!value || key === "from") {
        return;
      }
      if (Array.isArray(value)) {
        value.filter(Boolean).forEach((entry) => storeQueryParams.append(key, entry));
        return;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        storeQueryParams.append(key, value);
      }
    });
  }
  const storeHref = storeQueryParams.toString()
    ? `/store?${storeQueryParams.toString()}`
    : "/store";

  const supabase = createSupabasePublicClient();
  const service = new StorefrontService(supabase);

  // OPTIMIZATION: Parallel data fetching
  const [productsResult, filterData] = await Promise.all([
    service.listProducts(filters),
    service.listFilters({ filters }),
  ]);

  let pageCount = Math.max(1, Math.ceil(productsResult.total / productsResult.limit));

  // Handle page overflow
  if (productsResult.total > 0 && productsResult.page > pageCount) {
    const adjustedFilters = { ...filters, page: pageCount };
    const adjustedResult = await service.listProducts(adjustedFilters);
    pageCount = Math.max(1, Math.ceil(adjustedResult.total / adjustedResult.limit));
  }

  const brandOptions = filterData.brands.map((brand) => ({
    value: brand.label,
    label: brand.label,
  }));

  const selectedCategories = filters.category ?? [];
  const selectedBrands = filters.brand ?? [];
  const selectedModels = filters.model ?? [];
  const selectedShoeSizes = filters.sizeShoe ?? [];
  const selectedClothingSizes = filters.sizeClothing ?? [];
  const selectedConditions = filters.condition ?? [];
  const query = filters.q ?? "";

  const formatLabel = (value: string) =>
    value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());

  const activeFilterLabels = Array.from(
    new Set([
      ...selectedCategories.map(formatLabel),
      ...selectedBrands,
      ...selectedModels,
      ...selectedShoeSizes,
      ...selectedClothingSizes,
      ...selectedConditions.map(formatLabel),
    ]),
  );

  const browseLabel = (() => {
    if (query) {
      return `Search: "${query}"`;
    }
    if (activeFilterLabels.length === 0) {
      return `Shop All`;
    }
    if (activeFilterLabels.length === 1) {
      return `${activeFilterLabels[0]}`;
    }
    return `Multiple Categories`;
  })();

  const breadcrumbItems = (() => {
    const items: Array<{ label: string; href?: string }> = [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/store" },
    ];

    if (query || activeFilterLabels.length > 0) {
      items.push({ label: browseLabel });
    }

    return items;
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            return (
              <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-zinc-300" : ""}>{item.label}</span>
                )}
                {!isLast && <span className="text-zinc-700">/</span>}
              </div>
            );
          })}
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">{browseLabel}</h1>
      </div>

      <StoreControls
        total={productsResult.total}
        page={productsResult.page}
        pageCount={pageCount}
        limit={productsResult.limit}
        sort={filters.sort ?? "newest"}
        showPagination={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="hidden lg:block">
          <div
            className="sticky transition-[top] duration-300"
            style={{ top: "var(--rdk-header-offset, 0px)" }}
          >
            <FilterPanel
              selectedCategories={selectedCategories}
              selectedBrands={selectedBrands}
              selectedModels={selectedModels}
              selectedShoeSizes={selectedShoeSizes}
              selectedClothingSizes={selectedClothingSizes}
              selectedConditions={selectedConditions}
              categories={filterData.categories}
              brands={brandOptions}
              modelsByBrand={filterData.modelsByBrand}
              brandsByCategory={filterData.brandsByCategory}
              availableShoeSizes={filterData.availableShoeSizes}
              availableClothingSizes={filterData.availableClothingSizes}
              availableConditions={filterData.availableConditions}
              totalProducts={productsResult.total}
            />
          </div>
        </div>

        <div className="lg:col-span-3">
          <ProductGrid products={productsResult.products} storeHref={storeHref} />
        </div>
      </div>

      <div className="lg:hidden">
        <FilterPanel
          selectedCategories={selectedCategories}
          selectedBrands={selectedBrands}
          selectedModels={selectedModels}
          selectedShoeSizes={selectedShoeSizes}
          selectedClothingSizes={selectedClothingSizes}
          selectedConditions={selectedConditions}
          categories={filterData.categories}
          brands={brandOptions}
          modelsByBrand={filterData.modelsByBrand}
          brandsByCategory={filterData.brandsByCategory}
          availableShoeSizes={filterData.availableShoeSizes}
          availableClothingSizes={filterData.availableClothingSizes}
          availableConditions={filterData.availableConditions}
          totalProducts={productsResult.total}
        />
      </div>

      <div className="mt-10">
        <StoreControls
          total={productsResult.total}
          page={productsResult.page}
          pageCount={pageCount}
          limit={productsResult.limit}
          sort={filters.sort ?? "newest"}
          showSortControls={false}
        />
      </div>
    </div>
  );
}
