// src/services/featured-items-service.ts
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { FeaturedItemsRepository } from "@/repositories/featured-items-repo";
import { ProductRepository } from "@/modules/catalog/product-repository";
import { log } from "@/lib/utils/log";

export class FeaturedItemsService {
  private repo: FeaturedItemsRepository;
  private productRepo: ProductRepository;

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.repo = new FeaturedItemsRepository(supabase);
    this.productRepo = new ProductRepository(supabase);
  }

  /**
   * Get featured items for display on home page
   * Returns only in-stock, active products
   */
  async getFeaturedItems(tenantId?: string) {
    const items = await this.repo.list(tenantId);

    // Sort images by primary first, then sort_order
    return items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        images: (item.product.images ?? []).sort((a, b) => {
          if (a.is_primary && !b.is_primary) {
            return -1;
          }
          if (!a.is_primary && b.is_primary) {
            return 1;
          }
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }),
      },
    }));
  }

  /**
   * Add a product to featured items
   */
  async addFeaturedItem(input: { productId: string; tenantId?: string; userId: string }) {
    // Verify product exists and is eligible
    const product = await this.productRepo.getById(input.productId, {
      includeOutOfStock: true,
      includeUnpublished: true,
    });

    if (!product) {
      throw new Error("Product not found");
    }

    if (!product.is_active) {
      throw new Error("Cannot feature inactive product");
    }

    // Check if already featured
    const isFeatured = await this.repo.isFeatured(input.productId, input.tenantId);
    if (isFeatured) {
      throw new Error("Product is already featured");
    }

    const result = await this.repo.add(input);

    log({
      level: "info",
      layer: "service",
      message: "featured_item_added",
      productId: input.productId,
      userId: input.userId,
    });

    return result;
  }

  /**
   * Remove a product from featured items
   */
  async removeFeaturedItem(productId: string, tenantId?: string, userId?: string) {
    await this.repo.remove(productId, tenantId);

    log({
      level: "info",
      layer: "service",
      message: "featured_item_removed",
      productId,
      userId,
    });
  }

  /**
   * Reorder featured items
   */
  async reorderFeaturedItems(
    updates: Array<{ id: string; sortOrder: number }>,
    tenantId?: string,
    userId?: string,
  ) {
    await this.repo.updateOrder(updates, tenantId);

    log({
      level: "info",
      layer: "service",
      message: "featured_items_reordered",
      count: updates.length,
      userId,
    });
  }

  /**
   * Check if a product is featured
   */
  async isProductFeatured(productId: string, tenantId?: string): Promise<boolean> {
    return this.repo.isFeatured(productId, tenantId);
  }

  /**
   * Get featured items count
   */
  async getFeaturedItemsCount(tenantId?: string): Promise<number> {
    return this.repo.count(tenantId);
  }
}
