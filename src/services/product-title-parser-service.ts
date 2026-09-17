// src/services/product-title-parser-service.ts
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { CatalogRepository } from "@/modules/catalog/catalog-repository";
import {
  normalizeLabel,
  parseTitleWithCatalog,
  type CatalogBrandAlias,
  type CatalogModelAlias,
  type TitleParseInput,
  type TitleParseResult,
} from "@/services/product-title-parser";

export class ProductTitleParserService {
  private catalogRepo: CatalogRepository;
  private catalogCache = new Map<
    string,
    Promise<{
      brandAliases: CatalogBrandAlias[];
      modelAliasesByBrand: Record<string, CatalogModelAlias[]>;
      modelAliasesAll: CatalogModelAlias[];
      preferredBrandIds: Set<string>;
    }>
  >();

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.catalogRepo = new CatalogRepository(supabase);
  }

  async parseTitle(
    input: TitleParseInput & { tenantId?: string | null },
  ): Promise<TitleParseResult> {
    const tenantId = input.tenantId ?? null;
    const cacheKey = tenantId ?? "__global__";

    let catalogPromise = this.catalogCache.get(cacheKey);
    if (!catalogPromise) {
      catalogPromise = this.loadCatalog(tenantId);
      this.catalogCache.set(cacheKey, catalogPromise);
    }

    const { brandAliases, modelAliasesByBrand, modelAliasesAll, preferredBrandIds } =
      await catalogPromise;

    return parseTitleWithCatalog(input, {
      brandAliases,
      modelAliasesByBrand,
      modelAliasesAll,
      preferredBrandIds,
    });
  }

  private async loadCatalog(tenantId: string | null) {
    const [brands, brandAliases, models, modelAliases] = await Promise.all([
      this.catalogRepo.listBrandsWithGroups(tenantId),
      this.catalogRepo.listBrandAliases(tenantId),
      this.catalogRepo.listModels(tenantId),
      this.catalogRepo.listModelAliasesAll(tenantId),
    ]);

    const brandAliasEntries: CatalogBrandAlias[] = [];
    const brandAliasKeys = new Set<string>();

    for (const brand of brands) {
      const normalized = normalizeLabel(brand.canonical_label);
      const key = `${brand.id}:${normalized}`;
      if (!brandAliasKeys.has(key)) {
        brandAliasKeys.add(key);
        brandAliasEntries.push({
          brandId: brand.id,
          brandLabel: brand.canonical_label,
          groupKey: brand.group?.key ?? null,
          aliasLabel: brand.canonical_label,
          aliasNormalized: normalized,
          priority: 0,
        });
      }
    }

    for (const alias of brandAliases) {
      if (!alias.brand) {
        continue;
      }
      const key = `${alias.brand.id}:${alias.alias_normalized}`;
      if (brandAliasKeys.has(key)) {
        continue;
      }
      brandAliasKeys.add(key);
      brandAliasEntries.push({
        brandId: alias.brand.id,
        brandLabel: alias.brand.canonical_label,
        groupKey: alias.brand.group?.key ?? null,
        aliasLabel: alias.alias_label,
        aliasNormalized: alias.alias_normalized,
        priority: alias.priority ?? 0,
      });
    }

    const PREFERRED_BRANDS = new Set(["nike"]);
    const DEPRIORITIZED_BRANDS = new Set(["off white", "off-white"]);

    const nikeBrand = brands.find((b) => normalizeLabel(b.canonical_label) === "nike");
    const preferredBrandIds = new Set<string>();
    if (nikeBrand) {
      preferredBrandIds.add(nikeBrand.id);
    }

    for (const entry of brandAliasEntries) {
      const label = normalizeLabel(entry.brandLabel);

      if (PREFERRED_BRANDS.has(label)) {
        entry.priority = Math.max(entry.priority ?? 0, 50);
      }

      if (DEPRIORITIZED_BRANDS.has(label)) {
        entry.priority = Math.min(entry.priority ?? 0, -10);
      }
    }

    const modelAliasEntries: CatalogModelAlias[] = [];
    const modelAliasKeys = new Set<string>();

    for (const model of models) {
      const normalized = normalizeLabel(model.canonical_label);
      const key = `${model.id}:${normalized}`;
      if (!modelAliasKeys.has(key)) {
        modelAliasKeys.add(key);
        modelAliasEntries.push({
          modelId: model.id,
          modelLabel: model.canonical_label,
          brandId: model.brand_id,
          aliasLabel: model.canonical_label,
          aliasNormalized: normalized,
          priority: 0,
        });
      }
    }

    for (const alias of modelAliases) {
      if (!alias.model) {
        continue;
      }
      const key = `${alias.model.id}:${alias.alias_normalized}`;
      if (modelAliasKeys.has(key)) {
        continue;
      }
      modelAliasKeys.add(key);
      modelAliasEntries.push({
        modelId: alias.model.id,
        modelLabel: alias.model.canonical_label,
        brandId: alias.model.brand_id,
        aliasLabel: alias.alias_label,
        aliasNormalized: alias.alias_normalized,
        priority: alias.priority ?? 0,
      });
    }

    const modelAliasesByBrand: Record<string, CatalogModelAlias[]> = {};
    for (const alias of modelAliasEntries) {
      if (!modelAliasesByBrand[alias.brandId]) {
        modelAliasesByBrand[alias.brandId] = [];
      }
      modelAliasesByBrand[alias.brandId].push(alias);
    }

    return {
      brandAliases: brandAliasEntries,
      modelAliasesByBrand,
      modelAliasesAll: modelAliasEntries,
      preferredBrandIds,
    };
  }
}
