// src/services/storefront-service.ts
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { expandShoeSizeSelection } from "@/config/constants/sizes";
import { CatalogRepository } from "./catalog-repository";
import { ProductRepository, type ProductFilters } from "./product-repository";

export class StorefrontService {
  private productRepo: ProductRepository;
  private catalogRepo: CatalogRepository;

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.productRepo = new ProductRepository(supabase);
    this.catalogRepo = new CatalogRepository(supabase);
  }

  async listProducts(filters: ProductFilters) {
    const expandedFilters = filters.sizeShoe?.length
      ? { ...filters, sizeShoe: expandShoeSizeSelection(filters.sizeShoe) }
      : filters;
    return this.productRepo.list(expandedFilters);
  }

  async getProductById(id: string, opts?: { includeOutOfStock?: boolean }) {
    return this.productRepo.getById(id, {
      includeOutOfStock: opts?.includeOutOfStock,
    });
  }

  async listFilters(opts?: { includeOutOfStock?: boolean; filters?: ProductFilters }) {
    const sizeFilters = opts?.filters ? { ...opts.filters } : undefined;
    if (sizeFilters) {
      sizeFilters.includeOutOfStock = opts?.includeOutOfStock;
      sizeFilters.sizeShoe = [];
      sizeFilters.sizeClothing = [];
    }

    const conditionFilters = opts?.filters ? { ...opts.filters } : undefined;
    if (conditionFilters) {
      conditionFilters.includeOutOfStock = opts?.includeOutOfStock;
      conditionFilters.condition = [];
    }

    const [data, sizeData, availableConditions] = await Promise.all([
      this.productRepo.listFilterData({
        includeOutOfStock: opts?.includeOutOfStock,
      }),
      this.productRepo.listAvailableSizes(sizeFilters),
      this.productRepo.listAvailableConditions(conditionFilters),
    ]);

    const brandMap = new Map<string, { label: string; isVerified: boolean }>();
    const modelsByBrand: Record<string, string[]> = {};
    const brandsByCategory: Record<string, string[]> = {};
    const modelSet = new Set<string>();
    const categorySet = new Set<string>();

    for (const product of data) {
      if (product.brand) {
        const existing = brandMap.get(product.brand);
        if (!existing) {
          brandMap.set(product.brand, {
            label: product.brand,
            isVerified: false,
          });
        } else {
          existing.isVerified = existing.isVerified || false;
        }
      }

      if (product.category === "sneakers" && product.model && product.brand) {
        modelSet.add(product.model);
        if (!modelsByBrand[product.brand]) {
          modelsByBrand[product.brand] = [];
        }
        if (!modelsByBrand[product.brand].includes(product.model)) {
          modelsByBrand[product.brand].push(product.model);
        }
      }

      if (product.category) {
        categorySet.add(product.category);
        if (product.brand) {
          if (!brandsByCategory[product.category]) {
            brandsByCategory[product.category] = [];
          }
          if (!brandsByCategory[product.category].includes(product.brand)) {
            brandsByCategory[product.category].push(product.brand);
          }
        }
      }
    }

    const sortWithOtherLast = (values: string[]) => {
      const sorted = values.slice().sort((a, b) => a.localeCompare(b));
      const otherIndex = sorted.findIndex((value) => value.toLowerCase() === "other");
      if (otherIndex === -1) {
        return sorted;
      }
      const [other] = sorted.splice(otherIndex, 1);
      sorted.push(other);
      return sorted;
    };

    const brands = sortWithOtherLast(
      Array.from(brandMap.values()).map((entry) => entry.label),
    ).map((label) => brandMap.get(label)!);

    for (const brand of Object.keys(modelsByBrand)) {
      modelsByBrand[brand] = modelsByBrand[brand].sort((a, b) => a.localeCompare(b));
    }

    for (const category of Object.keys(brandsByCategory)) {
      brandsByCategory[category] = sortWithOtherLast(brandsByCategory[category]);
    }

    const models = Array.from(modelSet).sort((a, b) => a.localeCompare(b));
    const categoryOrder = ["sneakers", "clothing", "accessories", "electronics"];
    const categories = Array.from(categorySet).sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a);
      const bIndex = categoryOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) {
        return a.localeCompare(b);
      }
      if (aIndex === -1) {
        return 1;
      }
      if (bIndex === -1) {
        return -1;
      }
      return aIndex - bIndex;
    });

    return {
      brands,
      models,
      modelsByBrand,
      brandsByCategory,
      categories,
      availableShoeSizes: sizeData.shoe,
      availableClothingSizes: sizeData.clothing,
      availableConditions,
    };
  }

  async listBrandGroupsByKeys(keys: Set<string>) {
    const groups = await this.catalogRepo.listBrandGroups(null, false);
    return groups.filter((group) => keys.has(group.key));
  }

  async listBrandsByGroupKey(groupKey: string | null) {
    const brands = await this.catalogRepo.listBrandsWithGroups(null, false);
    const filtered = groupKey
      ? brands.filter((brand) => brand.group?.key === groupKey)
      : brands;

    return filtered
      .map((brand) => brand.canonical_label)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }
}
