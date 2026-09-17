// src/services/product-service.ts
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { log } from "@/lib/utils/log";
import {
  ProductRepository,
  type ProductFilters,
  type InventoryExportRow,
} from "@/modules/catalog/product-repository";
import type { TablesInsert } from "@/types/db/database.types";
import type {
  Category,
  Condition,
  ProductRow,
  ProductWithDetails,
} from "@/types/domain/product";
import { CatalogRepository } from "@/modules/catalog/catalog-repository";
import { ProductSkuService } from "@/services/product-sku-service";
import { ProductTitleParserService } from "@/services/product-title-parser-service";

import { upsertTags, type TagInputItem } from "./tag-service";

type VariantWriteInput = Pick<
  TablesInsert<"product_variants">,
  "sku" | "size_label" | "sale_price_cents" | "stock" | "unit_cost_cents" | "sort_order"
>;

type VariantInput = Partial<Pick<VariantWriteInput, "sku">> &
  Omit<VariantWriteInput, "sku"> & {
    id?: string;
  };

type ImageInput = Pick<
  TablesInsert<"product_images">,
  "url" | "sort_order" | "is_primary"
>;

export interface ProductCreateInput {
  name: string;
  brand_override_id?: string | null;
  model_override_id?: string | null;
  category: Category;
  condition: Condition;
  size_type: ProductRow["size_type"];
  description?: string | null;
  go_live_at?: string;
  variants: VariantInput[];
  images: ImageInput[];
  tags?: TagInputItem[];
  excluded_auto_tag_keys?: string[];
}

export class ProductService {
  private repo: ProductRepository;

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.repo = new ProductRepository(supabase);
  }

  async exportInventory(filters: ProductFilters): Promise<InventoryExportRow[]> {
    const normalized = this.normalizeArchiveFilters(filters);
    return this.repo.exportInventoryRows(normalized);
  }

  async listProducts(filters: ProductFilters) {
    return this.repo.list(this.normalizeArchiveFilters(filters));
  }

  async getProductById(
    productId: string,
    options: {
      tenantId: string;
      includeOutOfStock?: boolean;
      includeUnpublished?: boolean;
      archivedStatus?: "active" | "archived" | "all";
    },
  ): Promise<ProductWithDetails | null> {
    const product = await this.repo.getById(productId, {
      includeOutOfStock: options.includeOutOfStock,
      includeUnpublished: options.includeUnpublished,
      archivedStatus: options.archivedStatus,
    });

    if (!product || product.tenant_id !== options.tenantId) {
      return null;
    }

    return product;
  }

  async createProduct(
    input: ProductCreateInput,
    ctx: {
      userId: string;
      tenantId: string;
      sellerId?: string | null;
    },
  ) {
    if (!input.name?.trim()) {
      throw new Error("Product title is required.");
    }

    const normalizedVariants = this.normalizeVariantSortOrder(input.variants);
    this.assertNoDuplicateVariantSizes(normalizedVariants);
    const variantsWithSkus = await this.assignVariantSkus(
      ctx.tenantId,
      normalizedVariants,
    );

    const parser = new ProductTitleParserService(this.supabase);
    const parsed = await parser.parseTitle({
      titleRaw: input.name,
      category: input.category,
      brandOverrideId: input.brand_override_id ?? null,
      modelOverrideId: input.model_override_id ?? null,
      tenantId: ctx.tenantId,
    });

    const product = await this.repo.create({
      tenant_id: ctx.tenantId,
      brand: parsed.brand.label,
      model: parsed.model.label ?? null,
      name: parsed.titleRaw,
      category: input.category,
      condition: input.condition,
      size_type: input.size_type,
      description: input.description || null,
      go_live_at: this.normalizeGoLiveAt(input.go_live_at),
      is_active: true,
      excluded_auto_tag_keys: input.excluded_auto_tag_keys ?? [],
      product_created_at: new Date().toISOString(),
      product_updated_at: new Date().toISOString(),
    });

    for (const variant of variantsWithSkus) {
      await this.repo.createVariant({
        tenant_id: ctx.tenantId,
        product_id: product.id,
        ...variant,
      });
    }

    for (const image of input.images) {
      await this.repo.createImage({
        product_id: product.id,
        ...image,
      });
    }

    const tags = await upsertTags(this.supabase, {
      tenantId: ctx.tenantId,
      tags: input.tags ?? [],
    });

    for (const tag of tags) {
      await this.repo.linkProductTag(product.id, tag.id);
    }

    await this.createCatalogCandidates(parsed, ctx);

    return product;
  }

  async updateProduct(
    productId: string,
    input: ProductCreateInput,
    ctx: { userId: string; tenantId: string },
  ) {
    const existing = await this.repo.getById(productId, {
      includeOutOfStock: true,
      includeUnpublished: true,
      archivedStatus: "all",
    });
    if (!existing) {
      throw new Error("Product not found");
    }
    if (!input.name?.trim()) {
      throw new Error("Product title is required.");
    }
    if (existing.archived_at) {
      throw new Error("Archived products are read-only until restored.");
    }

    const normalizedVariants = this.normalizeVariantSortOrder(input.variants);
    this.assertNoDuplicateVariantSizes(normalizedVariants);

    const tenantId = existing.tenant_id ?? ctx.tenantId;
    const parser = new ProductTitleParserService(this.supabase);
    const parsed = await parser.parseTitle({
      titleRaw: input.name,
      category: input.category,
      brandOverrideId: input.brand_override_id ?? null,
      modelOverrideId: input.model_override_id ?? null,
      tenantId,
    });

    const goLiveAt =
      input.go_live_at !== undefined
        ? this.normalizeGoLiveAt(input.go_live_at)
        : existing.go_live_at;

    const product = await this.repo.update(productId, {
      brand: parsed.brand.label,
      model: parsed.model.label ?? null,
      name: parsed.titleRaw,
      category: input.category,
      condition: input.condition,
      size_type: input.size_type,
      description: input.description || null,
      go_live_at: goLiveAt,
      excluded_auto_tag_keys: input.excluded_auto_tag_keys ?? [],
      product_updated_at: new Date().toISOString(),
    });

    const existingVariants = existing.variants ?? [];
    const existingVariantsById = new Map(
      existingVariants.map((variant) => [variant.id, variant]),
    );
    const incomingVariantIds = new Set<string>();
    const incomingExistingVariants: Array<{
      id: string;
      payload: VariantWriteInput;
    }> = [];
    const incomingNewVariants: VariantInput[] = [];

    for (const [index, variant] of normalizedVariants.entries()) {
      if (variant.id) {
        if (incomingVariantIds.has(variant.id)) {
          throw new Error("Duplicate variant entry in request.");
        }
        incomingVariantIds.add(variant.id);

        const existingVariant = existingVariantsById.get(variant.id);
        if (!existingVariant) {
          throw new Error("Invalid variant selected for this product.");
        }

        incomingExistingVariants.push({
          id: variant.id,
          payload: {
            sku: existingVariant.sku,
            size_label: variant.size_label,
            sale_price_cents: variant.sale_price_cents,
            stock: variant.stock,
            unit_cost_cents: variant.unit_cost_cents ?? 0,
            sort_order: variant.sort_order ?? index,
          },
        });
        continue;
      }

      incomingNewVariants.push(variant);
    }

    const variantsToDelete = existingVariants.filter(
      (variant) => !incomingVariantIds.has(variant.id),
    );
    if (variantsToDelete.length > 0) {
      const variantIdsToDelete = variantsToDelete.map((variant) => variant.id);

      await this.repo.deleteAbandonedOrderItems(variantIdsToDelete);

      const referencedVariantIds = new Set(
        await this.repo.listReferencedVariantIds(variantIdsToDelete),
      );

      if (referencedVariantIds.size > 0) {
        const blockedLabels = variantsToDelete
          .filter((variant) => referencedVariantIds.has(variant.id))
          .map((variant) => variant.size_label)
          .join(", ");

        throw new Error(
          `Cannot remove variant(s) with existing orders (${blockedLabels}). Set stock to 0 instead.`,
        );
      }

      for (const variant of variantsToDelete) {
        await this.repo.deleteVariant(variant.id);
      }
    }

    const variantsRequiringTemporaryKey = incomingExistingVariants.filter(
      ({ id, payload }) => {
        const existingVariant = existingVariantsById.get(id);
        return Boolean(
          existingVariant && existingVariant.size_label !== payload.size_label,
        );
      },
    );

    for (const { id } of variantsRequiringTemporaryKey) {
      await this.repo.updateVariant(id, {
        size_label: `__tmp__${productId}_${id}`,
      });
    }

    for (const { id, payload } of incomingExistingVariants) {
      await this.repo.updateVariant(id, payload);
    }

    const newVariantsWithSkus = await this.assignVariantSkus(
      tenantId,
      incomingNewVariants,
    );
    for (const payload of newVariantsWithSkus) {
      await this.repo.createVariant({
        tenant_id: tenantId,
        product_id: productId,
        ...payload,
      });
    }

    await this.repo.deleteImagesByProduct(productId);
    for (const image of input.images) {
      await this.repo.createImage({
        product_id: productId,
        ...image,
      });
    }

    await this.repo.unlinkProductTags(productId);
    const tags = await upsertTags(this.supabase, {
      tenantId,
      tags: input.tags ?? [],
    });

    for (const tag of tags) {
      await this.repo.linkProductTag(productId, tag.id);
    }

    await this.createCatalogCandidates(parsed, { ...ctx, tenantId });

    return product;
  }

  async duplicateProduct(
    productId: string,
    ctx: {
      userId: string;
      tenantId: string;
      sellerId?: string | null;
    },
  ) {
    const original = await this.repo.getById(productId, {
      includeOutOfStock: true,
      includeUnpublished: true,
    });
    if (!original) {
      throw new Error("Product not found");
    }

    const input: ProductCreateInput = {
      name: `${original.name} (Copy)`,
      category: original.category,
      condition: original.condition,
      size_type: original.size_type,
      description: original.description || undefined,
      go_live_at: original.go_live_at ?? undefined,
      brand_override_id: undefined,
      model_override_id: undefined,
      variants: original.variants.map((variant) => ({
        size_label: variant.size_label,
        sale_price_cents: variant.sale_price_cents,
        unit_cost_cents: variant.unit_cost_cents ?? 0,
        stock: variant.stock,
        sort_order: variant.sort_order ?? 0,
      })),
      images: original.images.map((img) => ({
        url: img.url,
        sort_order: img.sort_order,
        is_primary: img.is_primary,
      })),
      tags: original.tags.map((tag) => ({
        label: tag.label,
        group_key: tag.group_key,
      })),
      excluded_auto_tag_keys: original.excluded_auto_tag_keys ?? [],
    };

    return this.createProduct(input, ctx);
  }

  async syncSizeTags(productId: string) {
    const product = await this.repo.getById(productId, {
      includeOutOfStock: true,
      includeUnpublished: true,
    });
    if (!product) {
      return;
    }

    const sizeTagGroup =
      product.size_type === "shoe"
        ? "size_shoe"
        : product.size_type === "clothing"
          ? "size_clothing"
          : product.size_type === "custom"
            ? "size_custom"
            : null;

    const sizeTags = sizeTagGroup
      ? product.variants
          .filter((variant) => variant.stock > 0)
          .map((variant) => ({
            label: variant.size_label,
            group_key: sizeTagGroup,
          }))
      : [];
    const preservedTags = product.tags.filter(
      (tag) => !tag.group_key.startsWith("size_"),
    );

    await this.repo.unlinkProductTags(productId);
    const tags = await upsertTags(this.supabase, {
      tenantId: product.tenant_id ?? null,
      tags: [
        ...preservedTags.map((tag) => ({
          label: tag.label,
          group_key: tag.group_key,
        })),
        ...sizeTags,
      ],
    });

    for (const tag of tags) {
      await this.repo.linkProductTag(productId, tag.id);
    }
  }

  async deleteProduct(productId: string): Promise<{ archived: boolean }> {
    await this.repo.delete(productId);
    return { archived: false };
  }

  async archiveProduct(productId: string, tenantId: string) {
    const existing = await this.repo.getById(productId, {
      tenantId,
      includeOutOfStock: true,
      includeUnpublished: true,
      archivedStatus: "all",
    });

    if (!existing) {
      throw new Error("Product not found");
    }

    if (existing.archived_at) {
      return { archived: true };
    }

    await this.repo.archive(productId);
    return { archived: true };
  }

  async restoreProduct(productId: string, tenantId: string) {
    const existing = await this.repo.getById(productId, {
      tenantId,
      includeOutOfStock: true,
      includeUnpublished: true,
      archivedStatus: "all",
    });

    if (!existing) {
      throw new Error("Product not found");
    }

    if (!existing.archived_at) {
      return { restored: true };
    }

    await this.repo.restore(productId);
    return { restored: true };
  }

  async archiveProductsByIds(productIds: string[], tenantId: string) {
    const uniqueIds = [...new Set(productIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return { archivedCount: 0 };
    }

    const allowedIds: string[] = [];
    for (const productId of uniqueIds) {
      const product = await this.repo.getById(productId, {
        tenantId,
        includeOutOfStock: true,
        includeUnpublished: true,
        archivedStatus: "all",
      });

      if (product && !product.archived_at) {
        allowedIds.push(productId);
      }
    }

    const archivedCount = await this.repo.archiveMany(allowedIds);
    return { archivedCount };
  }

  async restoreProductsByIds(productIds: string[], tenantId: string) {
    const uniqueIds = [...new Set(productIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return { restoredCount: 0 };
    }

    const allowedIds: string[] = [];
    for (const productId of uniqueIds) {
      const product = await this.repo.getById(productId, {
        tenantId,
        includeOutOfStock: true,
        includeUnpublished: true,
        archivedStatus: "all",
      });

      if (product?.archived_at) {
        allowedIds.push(productId);
      }
    }

    const restoredCount = await this.repo.restoreMany(allowedIds);
    return { restoredCount };
  }

  async archiveProductsByFilters(
    tenantId: string,
    filters: {
      q?: string;
      category?: string[];
      condition?: string[];
      stockStatus?: "in_stock" | "out_of_stock" | "archived" | "all";
    },
  ) {
    const ids = await this.repo.listIds({
      tenantId,
      q: filters.q,
      category: filters.category,
      condition: filters.condition,
      stockStatus: filters.stockStatus,
      includeOutOfStock: true,
      searchMode: "inventory",
      archivedStatus: "active",
    });

    const archivedCount = await this.repo.archiveMany(ids);
    return { archivedCount };
  }

  async restoreProductsByFilters(
    tenantId: string,
    filters: {
      q?: string;
      category?: string[];
      condition?: string[];
      stockStatus?: "in_stock" | "out_of_stock" | "archived" | "all";
    },
  ) {
    const ids = await this.repo.listIds({
      tenantId,
      q: filters.q,
      category: filters.category,
      condition: filters.condition,
      stockStatus: filters.stockStatus === "archived" ? "all" : filters.stockStatus,
      includeOutOfStock: true,
      searchMode: "inventory",
      archivedStatus: "archived",
    });

    const restoredCount = await this.repo.restoreMany(ids);
    return { restoredCount };
  }

  async deleteProductsByIds(
    productIds: string[],
    tenantId: string,
    options?: {
      onBeforeDelete?: (productId: string) => Promise<void>;
    },
  ) {
    const uniqueIds = [...new Set(productIds.filter(Boolean))];
    let deletedCount = 0;
    let failedCount = 0;

    for (const productId of uniqueIds) {
      const product = await this.repo.getById(productId, {
        tenantId,
        includeOutOfStock: true,
        includeUnpublished: true,
        archivedStatus: "all",
      });

      if (!product) {
        failedCount += 1;
        continue;
      }

      try {
        await options?.onBeforeDelete?.(productId);
        await this.deleteProduct(productId);
        deletedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    return { deletedCount, failedCount };
  }

  async deleteProductsByFilters(
    tenantId: string,
    filters: {
      q?: string;
      category?: string[];
      condition?: string[];
      stockStatus?: "in_stock" | "out_of_stock" | "archived" | "all";
    },
    options?: {
      onBeforeDelete?: (productId: string) => Promise<void>;
    },
  ) {
    const normalizedFilters = this.normalizeArchiveFilters({
      tenantId,
      q: filters.q,
      category: filters.category,
      condition: filters.condition,
      stockStatus: filters.stockStatus,
      includeOutOfStock: true,
      searchMode: "inventory",
      archivedStatus: filters.stockStatus === "archived" ? "archived" : "active",
    });

    const ids = await this.repo.listIds(normalizedFilters);
    return this.deleteProductsByIds(ids, tenantId, options);
  }

  private normalizeArchiveFilters(filters: ProductFilters): ProductFilters {
    if (filters.stockStatus !== "archived") {
      return filters;
    }

    return {
      ...filters,
      stockStatus: "all",
      archivedStatus: "archived",
    };
  }

  private async assignVariantSkus(
    tenantId: string,
    variants: VariantInput[],
  ): Promise<VariantWriteInput[]> {
    const skuService = new ProductSkuService();
    const existingSkus = await this.repo.listVariantSkus(tenantId);
    const allocated = new Set(existingSkus);

    return variants.map((variant, index) => {
      const sku = variant.sku?.trim()
        ? skuService.normalizeImportedSku(variant.sku)
        : skuService.getNextNumericSku(Array.from(allocated));
      allocated.add(sku);

      return {
        sku,
        size_label: variant.size_label,
        sale_price_cents: variant.sale_price_cents,
        unit_cost_cents: variant.unit_cost_cents ?? 0,
        stock: variant.stock,
        sort_order: variant.sort_order ?? index,
      };
    });
  }

  private normalizeVariantSortOrder(variants: VariantInput[]): VariantInput[] {
    return variants.map((variant, index) => ({
      ...variant,
      sort_order: Number.isFinite(variant.sort_order) ? variant.sort_order : index,
    }));
  }

  private assertNoDuplicateVariantSizes(variants: VariantInput[]) {
    const seen = new Set<string>();

    for (const variant of variants) {
      const normalizedSizeLabel = variant.size_label.trim().toLowerCase();

      if (seen.has(normalizedSizeLabel)) {
        throw new Error(`Duplicate size "${variant.size_label}" found in variants.`);
      }

      seen.add(normalizedSizeLabel);
    }
  }

  private normalizeGoLiveAt(goLiveAt?: string): string {
    if (!goLiveAt?.trim()) {
      return new Date().toISOString();
    }
    const parsed = new Date(goLiveAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Invalid go-live date/time.");
    }
    return parsed.toISOString();
  }

  private async createCatalogCandidates(
    parsed: {
      candidates: {
        brand?: { rawText: string; normalizedText: string };
        model?: {
          rawText: string;
          normalizedText: string;
          parentBrandId?: string | null;
        };
      };
    },
    ctx: { userId: string; tenantId: string },
  ) {
    const catalogRepo = new CatalogRepository(this.supabase);

    if (parsed.candidates.brand?.rawText) {
      try {
        await catalogRepo.createCandidate({
          tenant_id: ctx.tenantId,
          entity_type: "brand",
          raw_text: parsed.candidates.brand.rawText,
          normalized_text: parsed.candidates.brand.normalizedText,
          status: "new",
          created_by: ctx.userId,
        });
      } catch (error) {
        log({
          level: "warn",
          layer: "service",
          message: "catalog_candidate_create_failed",
          entity: "brand",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (parsed.candidates.model?.rawText && parsed.candidates.model.parentBrandId) {
      try {
        await catalogRepo.createCandidate({
          tenant_id: ctx.tenantId,
          entity_type: "model",
          raw_text: parsed.candidates.model.rawText,
          normalized_text: parsed.candidates.model.normalizedText,
          parent_brand_id: parsed.candidates.model.parentBrandId,
          status: "new",
          created_by: ctx.userId,
        });
      } catch (error) {
        log({
          level: "warn",
          layer: "service",
          message: "catalog_candidate_create_failed",
          entity: "model",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
