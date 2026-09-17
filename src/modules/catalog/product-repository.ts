//  src/repositories/product-repo.ts
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/db/database.types";

export interface ProductFilters {
  q?: string;
  category?: string[];
  brand?: string[];
  model?: string[];
  sizeShoe?: string[];
  sizeClothing?: string[];
  condition?: string[];
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc";
  page?: number;
  limit?: number;
  stockStatus?: "in_stock" | "out_of_stock" | "archived" | "all";
  archivedStatus?: "active" | "archived" | "all";
  includeOutOfStock?: boolean;

  tenantId?: string;
  searchMode?: "storefront" | "inventory";
}

type ProductRow = Tables<"products">;
type VariantRow = Tables<"product_variants">;
type ImageRow = Tables<"product_images">;
type TagRow = Tables<"tags">;

export type ProductWithDetails = ProductRow & {
  variants: VariantRow[];
  images: ImageRow[];
  tags: TagRow[];
};

export type CartVariantDetails = {
  variantId: string;
  productId: string;
  sizeLabel: string;
  priceCents: number;
  sku: string;
  stock: number;
  brand: string;
  name: string;
  titleDisplay: string;
  isActive: boolean;
  isOutOfStock: boolean;
  imageUrl: string | null;
};

export type InventoryExportRow = {
  sku: string;
  name: string;
  size: string;
  type: string;
  condition: string;
  salePriceCents: number;
  unitCostCents: number;
  stock: number;
};

type VariantExportRow = {
  sku: string | null;
  size_label: string | null;
  sale_price_cents: number | null;
  unit_cost_cents: number | null;
  stock: number | null;
  product?: {
    name: string | null;
    condition: string | null;
    is_active: boolean | null;
    is_out_of_stock: boolean | null;
    tenant_id: string | null;
    category: string | null;
  };
};

type ProductInsert = TablesInsert<"products">;
type ProductUpdate = TablesUpdate<"products">;

type VariantInsert = TablesInsert<"product_variants">;
type VariantUpdate = TablesUpdate<"product_variants">;
type ImageInsert = TablesInsert<"product_images">;

type TagInsert = TablesInsert<"tags">;
const BULK_MUTATION_BATCH_SIZE = 100;

// Helper types for query results
type FilterDataRow = {
  brand: string | null;
  model: string | null;
  category: string | null;
};

type SizeAvailabilityRow = {
  size_label: string | null;
  product?: {
    size_type?: string | null;
  };
};

type ProductWithRelations = ProductRow & {
  variants?: VariantRow[];
  images?: ImageRow[];
  tags?: Array<{ tag: TagRow }>;
};

type VariantWithProduct = {
  product_id: string;
  sale_price_cents: number;
  product?: {
    id: string;
  };
};

type CartVariantRow = {
  id: string;
  product_id: string;
  sku: string;
  size_label: string;
  sale_price_cents: number;
  stock: number;
  product?: {
    id: string;
    brand: string;
    name: string;
    is_active: boolean;
    is_out_of_stock: boolean;
    go_live_at: string | null;
  };
};

type ProductImageRow = {
  product_id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
};

type SearchCandidateRow = {
  id: string;
  brand: string | null;
  name: string | null;
  model: string | null;
};

export class ProductRepository {
  private static readonly RECONCILIATION_PAGE_SIZE = 1000;

  constructor(private readonly supabase: TypedSupabaseClient) {}

  private readonly storefrontSearchFields = ["brand", "name", "model"];

  private readonly inventorySearchFields = ["brand", "name", "model"];

  private applyArchivedFilter<
    T extends {
      is: (column: string, value: null) => T;
      not: (column: string, operator: string, value: null) => T;
    },
  >(query: T, archivedStatus: ProductFilters["archivedStatus"] = "active"): T {
    if (archivedStatus === "archived") {
      return query.not("archived_at", "is", null);
    }
    if (archivedStatus === "all") {
      return query;
    }
    return query.is("archived_at", null);
  }

  async listForReconciliation(
    tenantId: string,
    archivedStatus: ProductFilters["archivedStatus"] = "active",
  ): Promise<ProductWithDetails[]> {
    const rows: ProductWithRelations[] = [];
    let offset = 0;

    while (true) {
      let query = this.supabase
        .from("products")
        .select(
          "*, variants:product_variants(*), images:product_images(*), tags:product_tags(tag:tags(*))",
        )
        .eq("tenant_id", tenantId);

      query = this.applyArchivedFilter(query, archivedStatus).order("created_at", {
        ascending: false,
      });

      const { data, error } = await query.range(
        offset,
        offset + ProductRepository.RECONCILIATION_PAGE_SIZE - 1,
      );

      if (error) {
        throw error;
      }

      const page = (data ?? []) as ProductWithRelations[];
      rows.push(...page);

      if (page.length < ProductRepository.RECONCILIATION_PAGE_SIZE) {
        break;
      }

      offset += ProductRepository.RECONCILIATION_PAGE_SIZE;
    }

    return rows.map((row) => this.transformProduct(row));
  }

  async exportInventoryRows(filters: ProductFilters): Promise<InventoryExportRow[]> {
    const includeOutOfStock = Boolean(filters.includeOutOfStock);

    let query = this.supabase
      .from("product_variants")
      .select(
        "sku, size_label, sale_price_cents, unit_cost_cents, stock, product:products!inner(name, condition, is_active, is_out_of_stock, tenant_id, category)",
      )
      .eq("product.is_active", true);

    if (filters.tenantId) {
      query = query.eq("product.tenant_id", filters.tenantId);
    }
    if (filters.archivedStatus === "archived") {
      query = query.not("product.archived_at", "is", null);
    } else if (filters.archivedStatus !== "all") {
      query = query.is("product.archived_at", null);
    }

    if (filters.stockStatus === "out_of_stock") {
      query = query.eq("product.is_out_of_stock", true);
    } else if (filters.stockStatus === "in_stock") {
      query = query.eq("product.is_out_of_stock", false).gt("stock", 0);
    } else if (!includeOutOfStock) {
      query = query.eq("product.is_out_of_stock", false).gt("stock", 0);
    }

    query = this.applyTextSearch(query, filters.q, this.inventorySearchFields, {
      foreignTable: "product",
    });
    if (filters.q?.trim()) {
      query = query.or(`sku.ilike.%${filters.q.trim().replace(/[(),]/g, " ")}%`);
    }

    if (filters.category?.length) {
      query = query.in("product.category", filters.category);
    }
    if (filters.condition?.length) {
      query = query.in("product.condition", filters.condition);
    }

    // Order for stable printing
    query = query
      .order("sku", { ascending: true })
      .order("size_label", { ascending: true });

    const { data, error } = await query.limit(20000);
    if (error) {
      throw error;
    }

    const rows = (data ?? []) as VariantExportRow[];

    return rows
      .map((row) => {
        const product = row.product;
        const sku = row.sku?.trim() ?? "";
        const name = product?.name?.trim() ?? "";
        const size = row.size_label?.trim() ?? "";
        const type = product?.category?.trim() ?? "";
        const condition = product?.condition?.trim() ?? "";

        if (!sku || !name || !size || !condition) {
          return null;
        }

        return {
          sku,
          name,
          size,
          type,
          condition,
          salePriceCents: Number(row.sale_price_cents ?? 0),
          unitCostCents: Number(row.unit_cost_cents ?? 0),
          stock: Number(row.stock ?? 0),
        } satisfies InventoryExportRow;
      })
      .filter((row): row is InventoryExportRow => row !== null);
  }

  async list(filters: ProductFilters = {}) {
    const { page = 1, limit = 20, sort = "newest", searchMode = "storefront" } = filters;
    const archivedStatus = filters.archivedStatus ?? "active";
    const offset = (page - 1) * limit;
    const isPriceSort = sort === "price_asc" || sort === "price_desc";
    const includeUnpublished = searchMode === "inventory";
    const nowIso = new Date().toISOString();
    const searchFields =
      searchMode === "inventory"
        ? this.inventorySearchFields
        : this.storefrontSearchFields;

    const sizeProductIds = isPriceSort
      ? null
      : await this.listProductIdsForSizes(filters);
    if (Array.isArray(sizeProductIds) && sizeProductIds.length === 0) {
      return { products: [], total: 0, skuTotal: 0, inventoryUnitTotal: 0, page, limit };
    }

    // IMPORTANT:
    // - Storefront must not include out-of-stock items by default.
    // - Admin can include them by passing includeOutOfStock=true.
    const includeOutOfStock = Boolean(filters.includeOutOfStock);

    let total = 0;
    let skuTotal = 0;
    let inventoryUnitTotal = 0;
    let ids: string[] = [];

    if (isPriceSort) {
      const result = await this.listProductIdsByPrice(
        filters,
        sort,
        includeOutOfStock,
        includeUnpublished,
        nowIso,
      );
      ids = result.ids;
      total = result.total;
      skuTotal = result.total;
      inventoryUnitTotal = 0;
    } else {
      // Build the base query with all filters
      let baseQuery = this.supabase
        .from("products")
        .select("id, brand, name, model", { count: "exact" });

      baseQuery = baseQuery.eq("is_active", true);
      baseQuery = this.applyArchivedFilter(baseQuery, archivedStatus);

      if (!includeUnpublished) {
        baseQuery = baseQuery.lte("go_live_at", nowIso);
      }

      if (filters.tenantId) {
        baseQuery = baseQuery.eq("tenant_id", filters.tenantId);
      }

      if (filters.stockStatus === "out_of_stock") {
        baseQuery = baseQuery.eq("is_out_of_stock", true);
      } else if (filters.stockStatus === "in_stock") {
        if (searchMode !== "inventory") {
          baseQuery = baseQuery.eq("is_out_of_stock", false);
        }
      } else if (!includeOutOfStock) {
        // default (storefront-safe)
        baseQuery = baseQuery.eq("is_out_of_stock", false);
      }

      // Text search
      baseQuery = this.applyTextSearch(baseQuery, filters.q, searchFields);

      // Category / brand / condition filters
      if (filters.category?.length) {
        baseQuery = baseQuery.in("category", filters.category);
      }
      if (filters.brand?.length) {
        baseQuery = baseQuery.in("brand", filters.brand);
      }
      if (filters.model?.length) {
        baseQuery = baseQuery.in("model", filters.model);
      }
      if (filters.condition?.length) {
        baseQuery = baseQuery.in("condition", filters.condition);
      }

      if (Array.isArray(sizeProductIds)) {
        baseQuery = baseQuery.in("id", sizeProductIds);
      }

      // Determine if we have a search query
      const hasSearchQuery = Boolean(filters.q?.trim());

      // For search queries, we need to fetch more results to properly rank them
      // So we'll get the total count first, then fetch accordingly
      let query = baseQuery;

      if (!hasSearchQuery) {
        // No search - use normal sorting and pagination
        switch (sort) {
          case "newest":
            query = query.order("created_at", { ascending: false });
            break;
          case "name_asc":
            query = query
              .order("name", { ascending: true })
              .order("created_at", { ascending: false });
            break;
          case "name_desc":
            query = query
              .order("name", { ascending: false })
              .order("created_at", { ascending: false });
            break;
        }
        query = query.range(offset, offset + limit - 1);
      } else {
        // For searches, fetch more results to score and rank them
        // Fetch up to 500 results to ensure good ranking
        const fetchLimit = 500;
        query = query.order("created_at", { ascending: false }).range(0, fetchLimit - 1);
      }

      const { data, error, count } = await query;
      if (error) {
        throw error;
      }

      const candidateRows = (data ?? []) as SearchCandidateRow[];
      total = count ?? 0;
      skuTotal =
        searchMode === "inventory"
          ? await this.countDistinctInventorySkus({
              filters,
              archivedStatus,
              includeUnpublished,
              nowIso,
            })
          : total;
      inventoryUnitTotal =
        searchMode === "inventory"
          ? await this.countTotalInventoryUnits({
              filters,
              archivedStatus,
              includeUnpublished,
              nowIso,
            })
          : 0;

      if (!hasSearchQuery) {
        ids = candidateRows.map((row) => row.id);
      } else {
        const candidatesWithScores = candidateRows.map((row) => ({
          row,
          score: this.calculateSearchRelevance(row, filters.q, searchFields),
        }));

        candidatesWithScores.sort((a, b) => b.score - a.score);
        ids = candidatesWithScores
          .slice(offset, offset + limit)
          .map((candidate) => candidate.row.id);
      }
    }
    if (ids.length === 0) {
      return { products: [], total, skuTotal, inventoryUnitTotal, page, limit };
    }

    let detailQuery = this.supabase
      .from("products")
      .select(
        "*, variants:product_variants(*), images:product_images(*), tags:product_tags(tag:tags(*))",
      )
      .in("id", ids)
      .eq("is_active", true);
    detailQuery = this.applyArchivedFilter(detailQuery, archivedStatus);

    if (!includeUnpublished) {
      detailQuery = detailQuery.lte("go_live_at", nowIso);
    }

    if (filters.stockStatus === "out_of_stock") {
      detailQuery = detailQuery.eq("is_out_of_stock", true);
    } else if (filters.stockStatus === "in_stock") {
      if (searchMode !== "inventory") {
        detailQuery = detailQuery.eq("is_out_of_stock", false);
      }
    } else if (!includeOutOfStock) {
      detailQuery = detailQuery.eq("is_out_of_stock", false);
    }

    if (filters.tenantId) {
      detailQuery = detailQuery.eq("tenant_id", filters.tenantId);
    }

    const { data: details, error: detailsError } = await detailQuery;

    if (detailsError) {
      throw detailsError;
    }

    const byId = new Map(
      (details ?? []).map((raw) => [
        raw.id,
        this.transformProduct(raw as ProductWithRelations),
      ]),
    );

    const products = ids
      .map((id) => byId.get(id))
      .filter(Boolean) as ProductWithDetails[];

    return {
      products,
      total,
      skuTotal,
      inventoryUnitTotal,
      page,
      limit,
    };
  }

  private async countDistinctInventorySkus(input: {
    filters: ProductFilters;
    archivedStatus: ProductFilters["archivedStatus"];
    includeUnpublished: boolean;
    nowIso: string;
  }) {
    const { filters, archivedStatus, includeUnpublished, nowIso } = input;
    const searchFields = this.inventorySearchFields;
    let query = this.supabase
      .from("product_variants")
      .select(
        "sku, product:products!inner(id, brand, name, model, category, condition, tenant_id, is_active, is_out_of_stock, archived_at, go_live_at)",
      )
      .eq("product.is_active", true);

    if (!includeUnpublished) {
      query = query.lte("product.go_live_at", nowIso);
    }

    if (filters.tenantId) {
      query = query.eq("product.tenant_id", filters.tenantId);
    }

    if (archivedStatus === "archived") {
      query = query.not("product.archived_at", "is", null);
    } else if (archivedStatus !== "all") {
      query = query.is("product.archived_at", null);
    }

    const shouldFilterOutOfStockProducts =
      filters.searchMode !== "inventory" &&
      (filters.stockStatus === "out_of_stock"
        ? false
        : filters.stockStatus === "in_stock"
          ? true
          : !Boolean(filters.includeOutOfStock));

    if (filters.stockStatus === "out_of_stock") {
      query = query.eq("product.is_out_of_stock", true);
    } else if (filters.stockStatus === "in_stock") {
      if (filters.searchMode !== "inventory") {
        query = query.eq("product.is_out_of_stock", false);
      }
    } else if (shouldFilterOutOfStockProducts) {
      query = query.eq("product.is_out_of_stock", false);
    }

    query = this.applyTextSearch(query, filters.q, searchFields, {
      foreignTable: "product",
    });
    if (filters.q?.trim()) {
      query = query.or(`sku.ilike.%${filters.q.trim().replace(/[(),]/g, " ")}%`);
    }

    if (filters.category?.length) {
      query = query.in("product.category", filters.category);
    }
    if (filters.brand?.length) {
      query = query.in("product.brand", filters.brand);
    }
    if (filters.model?.length) {
      query = query.in("product.model", filters.model);
    }
    if (filters.condition?.length) {
      query = query.in("product.condition", filters.condition);
    }

    const sizeProductIds = await this.listProductIdsForSizes(filters);
    if (Array.isArray(sizeProductIds)) {
      if (sizeProductIds.length === 0) {
        return 0;
      }
      query = query.in("product.id", sizeProductIds);
    }

    const { data, error } = await query.limit(20000);
    if (error) {
      throw error;
    }

    return new Set(
      (data ?? [])
        .map((row) => {
          const record = row as { sku?: string | null };
          return record.sku?.trim() ?? null;
        })
        .filter((sku): sku is string => Boolean(sku)),
    ).size;
  }

  private async countTotalInventoryUnits(input: {
    filters: ProductFilters;
    archivedStatus: ProductFilters["archivedStatus"];
    includeUnpublished: boolean;
    nowIso: string;
  }) {
    const { filters, archivedStatus, includeUnpublished, nowIso } = input;
    const searchFields = this.inventorySearchFields;
    let query = this.supabase
      .from("product_variants")
      .select(
        "stock, product:products!inner(id, brand, name, model, category, condition, tenant_id, is_active, is_out_of_stock, archived_at, go_live_at)",
      )
      .eq("product.is_active", true);

    if (!includeUnpublished) {
      query = query.lte("product.go_live_at", nowIso);
    }

    if (filters.tenantId) {
      query = query.eq("product.tenant_id", filters.tenantId);
    }

    if (archivedStatus === "archived") {
      query = query.not("product.archived_at", "is", null);
    } else if (archivedStatus !== "all") {
      query = query.is("product.archived_at", null);
    }

    const shouldFilterOutOfStockProducts =
      filters.searchMode !== "inventory" &&
      (filters.stockStatus === "out_of_stock"
        ? false
        : filters.stockStatus === "in_stock"
          ? true
          : !Boolean(filters.includeOutOfStock));

    if (filters.stockStatus === "out_of_stock") {
      query = query.eq("product.is_out_of_stock", true);
    } else if (filters.stockStatus === "in_stock") {
      if (filters.searchMode !== "inventory") {
        query = query.eq("product.is_out_of_stock", false);
      }
    } else if (shouldFilterOutOfStockProducts) {
      query = query.eq("product.is_out_of_stock", false);
    }

    query = this.applyTextSearch(query, filters.q, searchFields, {
      foreignTable: "product",
    });
    if (filters.q?.trim()) {
      query = query.or(`sku.ilike.%${filters.q.trim().replace(/[(),]/g, " ")}%`);
    }

    if (filters.category?.length) {
      query = query.in("product.category", filters.category);
    }
    if (filters.brand?.length) {
      query = query.in("product.brand", filters.brand);
    }
    if (filters.model?.length) {
      query = query.in("product.model", filters.model);
    }
    if (filters.condition?.length) {
      query = query.in("product.condition", filters.condition);
    }

    const sizeProductIds = await this.listProductIdsForSizes(filters);
    if (Array.isArray(sizeProductIds)) {
      if (sizeProductIds.length === 0) {
        return 0;
      }
      query = query.in("product.id", sizeProductIds);
    }

    const { data, error } = await query.limit(20000);
    if (error) {
      throw error;
    }

    return (data ?? []).reduce((sum, row) => {
      const record = row as { stock?: number | null };
      return sum + Number(record.stock ?? 0);
    }, 0);
  }

  async listIds(filters: ProductFilters = {}): Promise<string[]> {
    const includeUnpublished = filters.searchMode === "inventory";
    const nowIso = new Date().toISOString();
    const includeOutOfStock = Boolean(filters.includeOutOfStock);
    const archivedStatus = filters.archivedStatus ?? "active";
    const searchFields =
      filters.searchMode === "inventory"
        ? this.inventorySearchFields
        : this.storefrontSearchFields;

    let query = this.supabase.from("products").select("id").eq("is_active", true);
    query = this.applyArchivedFilter(query, archivedStatus);

    if (!includeUnpublished) {
      query = query.lte("go_live_at", nowIso);
    }

    if (filters.tenantId) {
      query = query.eq("tenant_id", filters.tenantId);
    }

    if (filters.stockStatus === "out_of_stock") {
      query = query.eq("is_out_of_stock", true);
    } else if (filters.stockStatus === "in_stock") {
      if (filters.searchMode !== "inventory") {
        query = query.eq("is_out_of_stock", false);
      }
    } else if (!includeOutOfStock) {
      query = query.eq("is_out_of_stock", false);
    }

    query = this.applyTextSearch(query, filters.q, searchFields);

    if (filters.category?.length) {
      query = query.in("category", filters.category);
    }
    if (filters.brand?.length) {
      query = query.in("brand", filters.brand);
    }
    if (filters.model?.length) {
      query = query.in("model", filters.model);
    }
    if (filters.condition?.length) {
      query = query.in("condition", filters.condition);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: { id: string }) => row.id);
  }

  async getById(
    id: string,
    opts?: Pick<ProductFilters, "tenantId" | "includeOutOfStock"> & {
      includeUnpublished?: boolean;
      includeInactive?: boolean;
      archivedStatus?: ProductFilters["archivedStatus"];
    },
  ): Promise<ProductWithDetails | null> {
    let query = this.supabase
      .from("products")
      .select(
        "*, variants:product_variants(*), images:product_images(*), tags:product_tags(tag:tags(*))",
      )
      .eq("id", id);
    if (!opts?.includeInactive) {
      query = query.eq("is_active", true);
    }
    query = this.applyArchivedFilter(query, opts?.archivedStatus ?? "active");

    if (!opts?.includeOutOfStock) {
      query = query.eq("is_out_of_stock", false);
    }
    if (!opts?.includeUnpublished) {
      query = query.lte("go_live_at", new Date().toISOString());
    }
    if (opts?.tenantId) {
      query = query.eq("tenant_id", opts.tenantId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }

    return this.transformProduct(data as ProductWithRelations);
  }

  async getVariantBySku(tenantId: string, sku: string) {
    const normalizedSku = sku.trim();
    if (!normalizedSku) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("product_variants")
      .select("id, product_id, sku")
      .eq("tenant_id", tenantId)
      .eq("sku", normalizedSku)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as Pick<VariantRow, "id" | "product_id" | "sku"> | null;
  }

  async findByTitleAndCategory(
    titleRaw: string,
    category: string,
    tenantId?: string,
  ): Promise<ProductRow | null> {
    let query = this.supabase
      .from("products")
      .select("*")
      .eq("name", titleRaw)
      .eq("category", category)
      .eq("is_active", true)
      .is("archived_at", null);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? null;
  }

  async create(product: ProductInsert) {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("products")
      .insert({
        ...product,
        product_created_at: product.product_created_at ?? now,
        product_updated_at: product.product_updated_at ?? now,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as ProductRow;
  }

  async update(id: string, product: ProductUpdate) {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("products")
      .update({
        ...product,
        product_updated_at: product.product_updated_at ?? now,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as ProductRow;
  }

  async delete(id: string) {
    const { error } = await this.supabase.from("products").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  async archive(id: string) {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from("products")
      .update({ archived_at: now, is_out_of_stock: true, product_updated_at: now })
      .eq("id", id);

    if (error) {
      throw error;
    }
  }

  async restore(id: string) {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from("products")
      .update({ archived_at: null, product_updated_at: now })
      .eq("id", id);

    if (error) {
      throw error;
    }
  }

  async restoreMany(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return 0;
    }

    let restoredCount = 0;

    for (let index = 0; index < uniqueIds.length; index += BULK_MUTATION_BATCH_SIZE) {
      const batch = uniqueIds.slice(index, index + BULK_MUTATION_BATCH_SIZE);
      const { data, error } = await this.supabase
        .from("products")
        .update({
          archived_at: null,
          product_updated_at: new Date().toISOString(),
        })
        .in("id", batch)
        .select("id");

      if (error) {
        throw error;
      }

      restoredCount += (data ?? []).length;
    }

    return restoredCount;
  }

  async archiveMany(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return 0;
    }

    let archivedCount = 0;
    const archivedAt = new Date().toISOString();

    for (let index = 0; index < uniqueIds.length; index += BULK_MUTATION_BATCH_SIZE) {
      const batch = uniqueIds.slice(index, index + BULK_MUTATION_BATCH_SIZE);
      const { data, error } = await this.supabase
        .from("products")
        .update({
          archived_at: archivedAt,
          is_out_of_stock: true,
          product_updated_at: archivedAt,
        })
        .in("id", batch)
        .select("id");

      if (error) {
        throw error;
      }

      archivedCount += (data ?? []).length;
    }

    return archivedCount;
  }

  async countOrderItemsForProduct(productId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async listVariantSkus(tenantId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("product_variants")
      .select("sku")
      .eq("tenant_id", tenantId);

    if (error) {
      throw error;
    }

    return (data ?? [])
      .map((row) => row.sku)
      .filter((sku): sku is string => typeof sku === "string" && sku.trim().length > 0);
  }

  async createVariant(variant: VariantInsert) {
    const { data, error } = await this.supabase
      .from("product_variants")
      .insert(variant)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as VariantRow;
  }

  async updateVariant(id: string, variant: VariantUpdate) {
    const { data, error } = await this.supabase
      .from("product_variants")
      .update(variant)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as VariantRow;
  }

  async deleteVariantsByProduct(productId: string) {
    const { error } = await this.supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId);

    if (error) {
      throw error;
    }
  }

  async deleteVariant(id: string) {
    const { error } = await this.supabase.from("product_variants").delete().eq("id", id);

    if (error) {
      throw error;
    }
  }

  async deleteAbandonedOrderItems(variantIds: string[]) {
    if (variantIds.length === 0) {
      return;
    }

    // First, get order_items for these variants that are in pending/canceled orders
    const { data: itemsToDelete, error: selectError } = await this.supabase
      .from("order_items")
      .select("id, order:orders!inner(status)")
      .in("variant_id", variantIds)
      .in("order.status", ["pending", "canceled"]);

    if (selectError) {
      throw selectError;
    }

    if (!itemsToDelete || itemsToDelete.length === 0) {
      return;
    }

    // Delete these order_items
    const itemIds = itemsToDelete.map((item) => item.id);
    const { error: deleteError } = await this.supabase
      .from("order_items")
      .delete()
      .in("id", itemIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  async listReferencedVariantIds(variantIds: string[]) {
    if (variantIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("order_items")
      .select("variant_id, order:orders!inner(status)")
      .in("variant_id", variantIds)
      .in("order.status", ["paid", "shipped"]);

    if (error) {
      throw error;
    }

    return [
      ...new Set(
        (data ?? [])
          .map((row) => row.variant_id)
          .filter((variantId): variantId is string => Boolean(variantId)),
      ),
    ];
  }

  async createImage(image: ImageInsert) {
    const { data, error } = await this.supabase
      .from("product_images")
      .insert(image)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as ImageRow;
  }

  async deleteImagesByProduct(productId: string) {
    const { error } = await this.supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);

    if (error) {
      throw error;
    }
  }

  async upsertTag(tag: TagInsert) {
    const { data, error } = await this.supabase
      .from("tags")
      .upsert(tag, { onConflict: "tenant_id,label,group_key" })
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data as TagRow;
  }

  async linkProductTag(productId: string, tagId: string) {
    const { error } = await this.supabase
      .from("product_tags")
      .insert({ product_id: productId, tag_id: tagId });

    if (error && (error as { code?: string }).code !== "23505") {
      throw error;
    }
  }

  async unlinkProductTags(productId: string) {
    const { error } = await this.supabase
      .from("product_tags")
      .delete()
      .eq("product_id", productId);

    if (error) {
      throw error;
    }
  }

  async getBrands(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("products")
      .select("brand")
      .eq("is_active", true)
      .eq("is_out_of_stock", false)
      .lte("go_live_at", new Date().toISOString());

    if (error) {
      throw error;
    }
    const brands = [
      ...new Set(
        (data ?? [])
          .map((p) => p.brand)
          .filter((brand): brand is string => Boolean(brand)),
      ),
    ];
    return brands.sort();
  }

  async listFilterData(opts?: { includeOutOfStock?: boolean }): Promise<FilterDataRow[]> {
    const includeOutOfStock = Boolean(opts?.includeOutOfStock);
    let query = this.supabase
      .from("products")
      .select("brand, model, category")
      .eq("is_active", true)
      .lte("go_live_at", new Date().toISOString());

    if (!includeOutOfStock) {
      query = query.eq("is_out_of_stock", false);
    }

    const { data, error } = await query.limit(2000);

    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => ({
      brand: row.brand ?? null,
      model: row.model ?? null,
      category: row.category ?? null,
    }));
  }

  async listAvailableSizes(filters?: ProductFilters) {
    const includeOutOfStock = Boolean(filters?.includeOutOfStock);
    let query = this.supabase
      .from("product_variants")
      .select("size_label, product:products!inner(size_type, is_active, is_out_of_stock)")
      .gt("stock", 0)
      .eq("product.is_active", true)
      .lte("product.go_live_at", new Date().toISOString());

    if (filters?.tenantId) {
      query = query.eq("product.tenant_id", filters.tenantId);
    }

    if (filters?.stockStatus === "out_of_stock") {
      query = query.eq("product.is_out_of_stock", true);
    } else if (filters?.stockStatus === "in_stock") {
      query = query.eq("product.is_out_of_stock", false);
    } else if (!includeOutOfStock) {
      query = query.eq("product.is_out_of_stock", false);
    }

    query = this.applyTextSearch(query, filters?.q, this.storefrontSearchFields, {
      foreignTable: "product",
    });

    if (filters?.category?.length) {
      query = query.in("product.category", filters.category);
    }
    if (filters?.brand?.length) {
      query = query.in("product.brand", filters.brand);
    }
    if (filters?.model?.length) {
      query = query.in("product.model", filters.model);
    }
    if (filters?.condition?.length) {
      query = query.in("product.condition", filters.condition);
    }

    const { data, error } = await query.limit(5000);

    if (error) {
      throw error;
    }

    const shoe = new Set<string>();
    const clothing = new Set<string>();

    for (const row of (data ?? []) as SizeAvailabilityRow[]) {
      const sizeLabel = row.size_label?.trim();
      if (!sizeLabel) {
        continue;
      }
      if (row.product?.size_type === "shoe") {
        shoe.add(sizeLabel);
      } else if (row.product?.size_type === "clothing") {
        clothing.add(sizeLabel);
      }
    }

    return { shoe: Array.from(shoe), clothing: Array.from(clothing) };
  }

  async listAvailableConditions(filters?: ProductFilters) {
    const includeOutOfStock = Boolean(filters?.includeOutOfStock);
    let query = this.supabase
      .from("product_variants")
      .select(
        "size_label, product:products!inner(size_type, condition, is_active, is_out_of_stock)",
      )
      .gt("stock", 0)
      .eq("product.is_active", true)
      .lte("product.go_live_at", new Date().toISOString());

    if (filters?.tenantId) {
      query = query.eq("product.tenant_id", filters.tenantId);
    }

    if (filters?.stockStatus === "out_of_stock") {
      query = query.eq("product.is_out_of_stock", true);
    } else if (filters?.stockStatus === "in_stock") {
      query = query.eq("product.is_out_of_stock", false);
    } else if (!includeOutOfStock) {
      query = query.eq("product.is_out_of_stock", false);
    }

    query = this.applyTextSearch(query, filters?.q, this.storefrontSearchFields, {
      foreignTable: "product",
    });

    if (filters?.category?.length) {
      query = query.in("product.category", filters.category);
    }
    if (filters?.brand?.length) {
      query = query.in("product.brand", filters.brand);
    }
    if (filters?.model?.length) {
      query = query.in("product.model", filters.model);
    }
    if (filters?.condition?.length) {
      query = query.in("product.condition", filters.condition);
    }

    const { data, error } = await query.limit(5000);

    if (error) {
      throw error;
    }

    const conditions = new Set<string>();
    for (const row of (data ?? []) as Array<{
      product?: { condition?: string | null };
    }>) {
      const condition = row?.product?.condition;
      if (condition) {
        conditions.add(condition);
      }
    }

    return Array.from(conditions);
  }

  private transformProduct(raw: ProductWithRelations): ProductWithDetails {
    const variants = Array.isArray(raw.variants) ? raw.variants : [];
    const images = Array.isArray(raw.images) ? raw.images : [];
    const tags = Array.isArray(raw.tags) ? raw.tags : [];

    return {
      ...(raw as ProductRow),
      variants: (variants as VariantRow[]).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
      images: (images as ImageRow[]).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
      tags: tags
        .map((pt) => {
          if (pt && typeof pt === "object" && "tag" in pt) {
            return pt.tag;
          }
          return null;
        })
        .filter((tag): tag is TagRow => tag !== null && tag !== undefined),
    };
  }

  private applyTextSearch<
    Query extends {
      or: (
        filters: string,
        opts?: { foreignTable?: string; referencedTable?: string },
      ) => Query;
    },
  >(
    query: Query,
    input: string | undefined,
    fields: string[],
    opts?: { foreignTable?: string; referencedTable?: string },
  ): Query {
    const terms = this.buildSearchTerms(input);
    if (terms.length === 0) {
      return query;
    }

    const clauses: string[] = [];
    for (const term of terms) {
      const safe = term.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
      if (!safe) {
        continue;
      }
      for (const field of fields) {
        clauses.push(`${field}.ilike.%${safe}%`);
      }
    }

    if (clauses.length === 0) {
      return query;
    }

    return query.or(clauses.join(","), opts) as Query;
  }

  private buildSearchTerms(input?: string): string[] {
    if (!input) {
      return [];
    }

    const normalized = input.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const terms = new Set<string>();
    const addTerm = (value: string) => {
      const next = value.trim();
      if (next.length >= 2) {
        terms.add(next);
      }
    };

    addTerm(normalized);

    const tokens = normalized.split(/\s+/);
    for (const token of tokens) {
      const cleaned = token.replace(/[^a-z0-9]/g, "");
      if (!cleaned) {
        continue;
      }

      addTerm(cleaned);

      if (cleaned.endsWith("ies") && cleaned.length > 4) {
        addTerm(`${cleaned.slice(0, -3)}y`);
      } else if (cleaned.endsWith("es") && cleaned.length > 4) {
        addTerm(cleaned.slice(0, -2));
      } else if (cleaned.endsWith("s") && cleaned.length > 3) {
        addTerm(cleaned.slice(0, -1));
      }
    }

    return Array.from(terms).slice(0, 8);
  }

  private buildInClause(values: string[]) {
    return values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(",");
  }

  /**
   * Calculate a relevance score for a product based on search terms.
   * Higher scores indicate better matches.
   */
  private calculateSearchRelevance(
    product: Pick<ProductRow, "brand" | "name" | "model"> | SearchCandidateRow,
    searchQuery: string | undefined,
    searchFields: string[],
  ): number {
    if (!searchQuery?.trim()) {
      return 0;
    }

    const query = searchQuery.trim().toLowerCase();
    const terms = this.buildSearchTerms(searchQuery);

    // Filter out the full phrase from individual terms to avoid double-counting
    const individualTerms = terms.filter((term) => term !== query);

    let score = 0;

    // Helper to get field values
    const getFieldValue = (field: string): string => {
      const value = product[field as keyof typeof product];
      return String(value ?? "").toLowerCase();
    };

    // Check each search field
    for (const field of searchFields) {
      const fieldValue = getFieldValue(field);
      if (!fieldValue) {
        continue;
      }

      // Exact match bonus (highest priority)
      if (fieldValue === query) {
        score += 1000;
        continue; // Skip other checks for exact matches
      }

      // Starts with query bonus
      if (fieldValue.startsWith(query)) {
        score += 500;
      }

      // Contains full query bonus (exact phrase)
      if (fieldValue.includes(query)) {
        score += 300;
      }

      // Count matching individual terms (excluding the full phrase)
      let matchingTerms = 0;
      for (const term of individualTerms) {
        if (fieldValue.includes(term)) {
          matchingTerms++;
        }
      }

      // Strong bonus for matching ALL individual terms (even if not exact phrase)
      if (individualTerms.length > 0 && matchingTerms === individualTerms.length) {
        score += 200;
      }

      // Bonus for each matching term (more important now)
      score += matchingTerms * 25;

      // Check for terms appearing in sequence (even with words between)
      if (individualTerms.length > 1) {
        let sequenceBonus = 0;
        for (let i = 0; i < individualTerms.length - 1; i++) {
          const term1Idx = fieldValue.indexOf(individualTerms[i]);
          const term2Idx = fieldValue.indexOf(individualTerms[i + 1]);
          if (term1Idx !== -1 && term2Idx > term1Idx) {
            sequenceBonus += 15;
          }
        }
        score += sequenceBonus;
      }

      // Product name is the raw title and primary inventory search field.
      if (field === "name") {
        score *= 1.5;
      }
    }

    return score;
  }

  private async listProductIdsByPrice(
    filters: ProductFilters,
    sort: "price_asc" | "price_desc",
    includeOutOfStock: boolean,
    includeUnpublished: boolean,
    nowIso: string,
  ) {
    const { page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;
    const hasSizeFilters = Boolean(
      filters.sizeShoe?.length || filters.sizeClothing?.length,
    );

    let sizeProductIds: string[] | null = null;
    if (hasSizeFilters) {
      sizeProductIds = await this.listProductIdsForSizes(filters);
      if (Array.isArray(sizeProductIds) && sizeProductIds.length === 0) {
        return { ids: [], total: 0 };
      }
    }

    let countQuery = this.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    if (!includeUnpublished) {
      countQuery = countQuery.lte("go_live_at", nowIso);
    }

    // Tenant scoping
    if (filters.tenantId) {
      countQuery = countQuery.eq("tenant_id", filters.tenantId);
    }

    if (filters.stockStatus === "out_of_stock") {
      countQuery = countQuery.eq("is_out_of_stock", true);
    } else if (filters.stockStatus === "in_stock") {
      countQuery = countQuery.eq("is_out_of_stock", false);
    } else if (!includeOutOfStock) {
      countQuery = countQuery.eq("is_out_of_stock", false);
    }

    // Text search
    countQuery = this.applyTextSearch(countQuery, filters.q, this.storefrontSearchFields);

    // Category / brand / condition filters
    if (filters.category?.length) {
      countQuery = countQuery.in("category", filters.category);
    }
    if (filters.brand?.length) {
      countQuery = countQuery.in("brand", filters.brand);
    }
    if (filters.model?.length) {
      countQuery = countQuery.in("model", filters.model);
    }
    if (filters.condition?.length) {
      countQuery = countQuery.in("condition", filters.condition);
    }
    if (Array.isArray(sizeProductIds)) {
      countQuery = countQuery.in("id", sizeProductIds);
    }

    const { count: total, error: countError } = await countQuery;
    if (countError) {
      throw countError;
    }
    if (!total) {
      return { ids: [], total: 0 };
    }

    const targetCount = offset + limit;
    const batchSize = Math.max(limit * 6, 120);
    const orderedIds: string[] = [];
    const seen = new Set<string>();
    let rangeStart = 0;

    while (orderedIds.length < targetCount) {
      let query = this.supabase
        .from("product_variants")
        .select("product_id, sale_price_cents, product:products!inner(id)")
        .order("sale_price_cents", { ascending: sort === "price_asc" })
        .order("product_id", { ascending: true })
        .range(rangeStart, rangeStart + batchSize - 1);

      if (!includeOutOfStock) {
        query = query.gt("stock", 0);
      }

      if (Array.isArray(sizeProductIds)) {
        query = query.in("product_id", sizeProductIds);
      }

      // Tenant scoping
      if (filters.tenantId) {
        query = query.eq("product.tenant_id", filters.tenantId);
      }

      if (filters.stockStatus === "out_of_stock") {
        query = query.eq("product.is_out_of_stock", true);
      } else if (filters.stockStatus === "in_stock") {
        query = query.eq("product.is_out_of_stock", false);
      } else if (!includeOutOfStock) {
        query = query.eq("product.is_out_of_stock", false);
      }

      query = query.eq("product.is_active", true);
      if (!includeUnpublished) {
        query = query.lte("product.go_live_at", nowIso);
      }

      // Text search on product fields
      query = this.applyTextSearch(query, filters.q, this.storefrontSearchFields, {
        foreignTable: "product",
      });

      // Category / brand / condition filters
      if (filters.category?.length) {
        query = query.in("product.category", filters.category);
      }
      if (filters.brand?.length) {
        query = query.in("product.brand", filters.brand);
      }
      if (filters.model?.length) {
        query = query.in("product.model", filters.model);
      }
      if (filters.condition?.length) {
        query = query.in("product.condition", filters.condition);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const row of data ?? []) {
        const variantRow = row as VariantWithProduct;
        const productId = variantRow.product_id;
        if (!productId || seen.has(productId)) {
          continue;
        }
        seen.add(productId);
        orderedIds.push(productId);
        if (orderedIds.length >= targetCount) {
          break;
        }
      }

      if (data.length < batchSize) {
        break;
      }
      rangeStart += batchSize;
    }

    return { ids: orderedIds.slice(offset, offset + limit), total };
  }

  private async listProductIdsForSizes(filters: ProductFilters) {
    const selectedSizeGroups = [
      { sizeType: "shoe", labels: filters.sizeShoe ?? [] },
      { sizeType: "clothing", labels: filters.sizeClothing ?? [] },
    ].filter((group) => group.labels.length > 0);

    if (selectedSizeGroups.length === 0) {
      return null;
    }

    const productIds = new Set<string>();

    for (const group of selectedSizeGroups) {
      let query = this.supabase
        .from("product_variants")
        .select("product_id, product:products!inner(size_type)")
        .eq("product.size_type", group.sizeType)
        .in("size_label", group.labels)
        .gt("stock", 0);

      if (filters.tenantId) {
        query = query.eq("tenant_id", filters.tenantId);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      for (const row of data ?? []) {
        if (row.product_id) {
          productIds.add(row.product_id);
        }
      }
    }

    return Array.from(productIds);
  }

  async getVariantsForCart(variantIds: string[]): Promise<CartVariantDetails[]> {
    if (variantIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("product_variants")
      .select(
        "id, product_id, sku, size_label, sale_price_cents, stock, product:products(id, brand, name, is_active, is_out_of_stock, go_live_at)",
      )
      .in("id", variantIds);

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    const productIds = [
      ...new Set(
        rows
          .map((row: CartVariantRow) => row.product?.id ?? row.product_id)
          .filter((id: string | null): id is string => Boolean(id)),
      ),
    ];

    const imageMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: images, error: imagesError } = await this.supabase
        .from("product_images")
        .select("product_id, url, is_primary, sort_order")
        .in("product_id", productIds)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });

      if (imagesError) {
        throw imagesError;
      }

      for (const image of images ?? []) {
        const img = image as ProductImageRow;
        if (!imageMap.has(img.product_id)) {
          imageMap.set(img.product_id, img.url);
        }
      }
    }

    const now = Date.now();

    return rows.map((row: CartVariantRow) => {
      const product = row.product;
      const goLiveAt = product?.go_live_at ? Date.parse(product.go_live_at) : Number.NaN;
      const isLive = Number.isFinite(goLiveAt) && goLiveAt <= now;
      return {
        variantId: row.id,
        productId: product?.id ?? row.product_id,
        sizeLabel: row.size_label,
        priceCents: row.sale_price_cents,
        sku: row.sku,
        stock: row.stock,
        brand: product?.brand ?? "",
        name: product?.name ?? "",
        titleDisplay: product?.name ?? "",
        isActive: (product?.is_active ?? false) && isLive,
        isOutOfStock: product?.is_out_of_stock ?? false,
        imageUrl: imageMap.get(product?.id ?? row.product_id) ?? null,
      };
    });
  }

  async getModels(category?: string): Promise<string[]> {
    let query = this.supabase
      .from("products")
      .select("model")
      .eq("is_active", true)
      .eq("is_out_of_stock", false)
      .lte("go_live_at", new Date().toISOString())
      .not("model", "is", null);

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    const models = [
      ...new Set(
        (data ?? [])
          .map((p) => p.model)
          .filter((model): model is string => Boolean(model)),
      ),
    ];
    return models.sort();
  }
}
