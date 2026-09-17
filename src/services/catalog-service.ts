// src/services/catalog-service.ts
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { CatalogRepository } from "@/modules/catalog/catalog-repository";
import { normalizeLabel } from "@/services/product-title-parser";

export class CatalogService {
  private repo: CatalogRepository;

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.repo = new CatalogRepository(supabase);
  }

  async listBrandGroups(tenantId?: string | null, includeInactive = false) {
    return this.repo.listBrandGroups(tenantId, includeInactive);
  }

  async createBrandGroup(input: {
    tenantId: string | null;
    key: string;
    label: string;
    isActive?: boolean;
  }) {
    return this.repo.createBrandGroup({
      tenant_id: input.tenantId,
      key: input.key,
      label: input.label,
      is_active: input.isActive ?? true,
    });
  }

  async updateBrandGroup(
    id: string,
    input: { key?: string; label?: string; isActive?: boolean },
  ) {
    return this.repo.updateBrandGroup(id, {
      key: input.key,
      label: input.label,
      is_active: input.isActive,
    });
  }

  async listBrands(
    tenantId?: string | null,
    groupId?: string | null,
    includeInactive = false,
  ) {
    return this.repo
      .listBrandsWithGroups(tenantId, includeInactive)
      .then((brands) =>
        groupId ? brands.filter((brand) => brand.group_id === groupId) : brands,
      );
  }

  async createBrand(input: {
    tenantId: string | null;
    groupId: string;
    canonicalLabel: string;
    isActive?: boolean;
    isVerified?: boolean;
  }) {
    return this.repo.createBrand({
      tenant_id: input.tenantId,
      group_id: input.groupId,
      canonical_label: input.canonicalLabel,
      is_active: input.isActive ?? true,
      is_verified: input.isVerified ?? true,
    });
  }

  async updateBrand(
    id: string,
    input: {
      groupId?: string;
      canonicalLabel?: string;
      isActive?: boolean;
      isVerified?: boolean;
    },
  ) {
    return this.repo.updateBrand(id, {
      group_id: input.groupId,
      canonical_label: input.canonicalLabel,
      is_active: input.isActive,
      is_verified: input.isVerified,
    });
  }

  async listModels(
    tenantId?: string | null,
    brandId?: string | null,
    includeInactive = false,
  ) {
    return this.repo.listModels(tenantId, brandId, includeInactive);
  }

  async createModel(input: {
    tenantId: string | null;
    brandId: string;
    canonicalLabel: string;
    isActive?: boolean;
    isVerified?: boolean;
  }) {
    return this.repo.createModel({
      tenant_id: input.tenantId,
      brand_id: input.brandId,
      canonical_label: input.canonicalLabel,
      is_active: input.isActive ?? true,
      is_verified: input.isVerified ?? true,
    });
  }

  async updateModel(
    id: string,
    input: {
      brandId?: string;
      canonicalLabel?: string;
      isActive?: boolean;
      isVerified?: boolean;
    },
  ) {
    return this.repo.updateModel(id, {
      brand_id: input.brandId,
      canonical_label: input.canonicalLabel,
      is_active: input.isActive,
      is_verified: input.isVerified,
    });
  }

  async listAliases(
    tenantId?: string | null,
    entityType?: "brand" | "model",
    includeInactive = false,
  ) {
    return this.repo.listAliases(tenantId, entityType, includeInactive);
  }

  async createAlias(input: {
    tenantId: string | null;
    entityType: "brand" | "model";
    brandId?: string | null;
    modelId?: string | null;
    aliasLabel: string;
    priority?: number;
    isActive?: boolean;
  }) {
    return this.repo.createAlias({
      tenant_id: input.tenantId,
      entity_type: input.entityType,
      brand_id: input.brandId ?? null,
      model_id: input.modelId ?? null,
      alias_label: input.aliasLabel,
      alias_normalized: normalizeLabel(input.aliasLabel),
      priority: input.priority ?? 0,
      is_active: input.isActive ?? true,
    });
  }

  async updateAlias(
    id: string,
    input: { aliasLabel?: string; priority?: number; isActive?: boolean },
  ) {
    const normalized = input.aliasLabel ? normalizeLabel(input.aliasLabel) : undefined;
    return this.repo.updateAlias(id, {
      alias_label: input.aliasLabel,
      alias_normalized: normalized,
      priority: input.priority,
      is_active: input.isActive,
    });
  }

  async listCandidates(tenantId: string, status?: string) {
    return this.repo.listCandidates(tenantId, status);
  }

  async rejectCandidate(id: string) {
    return this.repo.updateCandidate(id, { status: "rejected" });
  }

  async acceptCandidate(input: {
    id: string;
    tenantId: string;
    groupId?: string | null;
    canonicalLabel?: string;
  }) {
    const candidate = await this.repo.getCandidateById(input.id);
    if (!candidate) {
      throw new Error("Candidate not found");
    }

    if (candidate.status === "accepted") {
      return candidate;
    }

    if (candidate.entity_type === "brand") {
      let groupId = input.groupId ?? null;
      if (!groupId) {
        const groups = await this.repo.listBrandGroups(input.tenantId, true);
        const other = groups.find((group) => group.key === "other");
        groupId = other?.id ?? null;
      }

      if (!groupId) {
        throw new Error("Brand group is required to accept brand candidate.");
      }

      const label = input.canonicalLabel ?? candidate.raw_text;
      const brand = await this.repo.createBrand({
        tenant_id: candidate.tenant_id,
        group_id: groupId,
        canonical_label: label,
        is_active: true,
        is_verified: true,
      });

      await this.repo.createAlias({
        tenant_id: candidate.tenant_id,
        entity_type: "brand",
        brand_id: brand.id,
        model_id: null,
        alias_label: candidate.raw_text,
        alias_normalized: normalizeLabel(candidate.raw_text),
        priority: 0,
        is_active: true,
      });
    } else {
      if (!candidate.parent_brand_id) {
        throw new Error("Model candidate missing parent brand.");
      }

      const label = input.canonicalLabel ?? candidate.raw_text;
      const model = await this.repo.createModel({
        tenant_id: candidate.tenant_id,
        brand_id: candidate.parent_brand_id,
        canonical_label: label,
        is_active: true,
        is_verified: true,
      });

      await this.repo.createAlias({
        tenant_id: candidate.tenant_id,
        entity_type: "model",
        brand_id: null,
        model_id: model.id,
        alias_label: candidate.raw_text,
        alias_normalized: normalizeLabel(candidate.raw_text),
        priority: 0,
        is_active: true,
      });
    }

    return this.repo.updateCandidate(candidate.id, { status: "accepted" });
  }
}
