// src/repositories/catalog-repo.ts
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/db/database.types";

type BrandGroupRow = Tables<"catalog_brand_groups">;
type BrandRow = Tables<"catalog_brands">;
type ModelRow = Tables<"catalog_models">;
type AliasRow = Tables<"catalog_aliases">;
type CandidateRow = Tables<"catalog_candidates">;

type BrandGroupInsert = TablesInsert<"catalog_brand_groups">;
type BrandInsert = TablesInsert<"catalog_brands">;
type ModelInsert = TablesInsert<"catalog_models">;
type AliasInsert = TablesInsert<"catalog_aliases">;
type CandidateInsert = TablesInsert<"catalog_candidates">;

type BrandGroupUpdate = TablesUpdate<"catalog_brand_groups">;
type BrandUpdate = TablesUpdate<"catalog_brands">;
type ModelUpdate = TablesUpdate<"catalog_models">;
type AliasUpdate = TablesUpdate<"catalog_aliases">;
type CandidateUpdate = TablesUpdate<"catalog_candidates">;

// Type for Supabase query builder with tenant_id filtering
type QueryWithTenantScope = {
  is: (column: string, value: null) => QueryWithTenantScope;
  or: (filter: string) => QueryWithTenantScope;
};

export class CatalogRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  private withTenantScope<T extends QueryWithTenantScope>(
    query: T,
    tenantId?: string | null,
  ): T {
    if (!tenantId) {
      return query.is("tenant_id", null) as T;
    }
    return query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`) as T;
  }

  async listBrandGroups(
    tenantId?: string | null,
    includeInactive = false,
  ): Promise<BrandGroupRow[]> {
    let query = this.supabase.from("catalog_brand_groups").select("*");
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    query = this.withTenantScope(query, tenantId);
    query = query.order("label", { ascending: true });
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async createBrandGroup(input: BrandGroupInsert): Promise<BrandGroupRow> {
    const { data, error } = await this.supabase
      .from("catalog_brand_groups")
      .insert(input)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async updateBrandGroup(id: string, input: BrandGroupUpdate): Promise<BrandGroupRow> {
    const { data, error } = await this.supabase
      .from("catalog_brand_groups")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async listBrands(
    tenantId?: string | null,
    groupId?: string | null,
    includeInactive = false,
  ): Promise<BrandRow[]> {
    let query = this.supabase.from("catalog_brands").select("*");
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    if (groupId) {
      query = query.eq("group_id", groupId);
    }
    query = this.withTenantScope(query, tenantId);
    query = query.order("canonical_label", { ascending: true });
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async listBrandsWithGroups(tenantId?: string | null, includeInactive = false) {
    let query = this.supabase
      .from("catalog_brands")
      .select("*, group:catalog_brand_groups(id, key, label)");
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    query = this.withTenantScope(query, tenantId);
    query = query.order("canonical_label", { ascending: true });
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async getBrandById(id: string): Promise<BrandRow | null> {
    const { data, error } = await this.supabase
      .from("catalog_brands")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? null;
  }

  async createBrand(input: BrandInsert): Promise<BrandRow> {
    const { data, error } = await this.supabase
      .from("catalog_brands")
      .insert(input)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async updateBrand(id: string, input: BrandUpdate): Promise<BrandRow> {
    const { data, error } = await this.supabase
      .from("catalog_brands")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async listModels(
    tenantId?: string | null,
    brandId?: string | null,
    includeInactive = false,
  ): Promise<ModelRow[]> {
    let query = this.supabase.from("catalog_models").select("*");
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    if (brandId) {
      query = query.eq("brand_id", brandId);
    }
    query = this.withTenantScope(query, tenantId);
    query = query.order("canonical_label", { ascending: true });
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async listModelsWithBrand(
    tenantId?: string | null,
    brandId?: string | null,
    includeInactive = false,
  ) {
    let query = this.supabase
      .from("catalog_models")
      .select("*, brand:catalog_brands(id, canonical_label, group_id)");
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    if (brandId) {
      query = query.eq("brand_id", brandId);
    }
    query = this.withTenantScope(query, tenantId);
    query = query.order("canonical_label", { ascending: true });
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async getModelById(id: string): Promise<ModelRow | null> {
    const { data, error } = await this.supabase
      .from("catalog_models")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? null;
  }

  async createModel(input: ModelInsert): Promise<ModelRow> {
    const { data, error } = await this.supabase
      .from("catalog_models")
      .insert(input)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async updateModel(id: string, input: ModelUpdate): Promise<ModelRow> {
    const { data, error } = await this.supabase
      .from("catalog_models")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async listAliases(
    tenantId?: string | null,
    entityType?: "brand" | "model",
    includeInactive = false,
  ): Promise<AliasRow[]> {
    let query = this.supabase.from("catalog_aliases").select("*");
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    if (entityType) {
      query = query.eq("entity_type", entityType);
    }
    query = this.withTenantScope(query, tenantId);
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async listBrandAliases(tenantId?: string | null) {
    let query = this.supabase
      .from("catalog_aliases")
      .select(
        "*, brand:catalog_brands(id, canonical_label, group:catalog_brand_groups(id, key, label))",
      )
      .eq("entity_type", "brand")
      .eq("is_active", true);
    query = this.withTenantScope(query, tenantId);
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async listModelAliases(tenantId: string | null | undefined, brandId: string) {
    let query = this.supabase
      .from("catalog_aliases")
      .select("*, model:catalog_models(id, canonical_label, brand_id)")
      .eq("entity_type", "model")
      .eq("is_active", true);
    query = this.withTenantScope(query, tenantId);
    query = query.eq("catalog_models.brand_id", brandId);
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async listModelAliasesAll(tenantId?: string | null) {
    let query = this.supabase
      .from("catalog_aliases")
      .select("*, model:catalog_models(id, canonical_label, brand_id)")
      .eq("entity_type", "model")
      .eq("is_active", true);
    query = this.withTenantScope(query, tenantId);
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async createAlias(input: AliasInsert): Promise<AliasRow> {
    const { data, error } = await this.supabase
      .from("catalog_aliases")
      .insert(input)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async updateAlias(id: string, input: AliasUpdate): Promise<AliasRow> {
    const { data, error } = await this.supabase
      .from("catalog_aliases")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async listCandidates(tenantId: string, status?: string): Promise<CandidateRow[]> {
    let query = this.supabase
      .from("catalog_candidates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (status) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async createCandidate(input: CandidateInsert): Promise<CandidateRow> {
    const { data, error } = await this.supabase
      .from("catalog_candidates")
      .insert(input)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async updateCandidate(id: string, input: CandidateUpdate): Promise<CandidateRow> {
    const { data, error } = await this.supabase
      .from("catalog_candidates")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async getCandidateById(id: string): Promise<CandidateRow | null> {
    const { data, error } = await this.supabase
      .from("catalog_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? null;
  }
}
