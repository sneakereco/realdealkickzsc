import "server-only";
import { createHash } from "node:crypto";

import { z } from "zod";

import { env } from "@/config/env";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/db/database.types";
import { ProductTitleParserService } from "@/services/product-title-parser-service";
import { buildAutoProductTags, upsertTags } from "@/services/tag-service";

import { familyCorrectionsSchema, type FamilyCorrections } from "./reconciliation";

import type {
  CanonicalLightspeedFamily,
  CatalogReconciliationStore,
  ReconciliationSummary,
  ReportProgress,
} from "./reconciliation";

const pageSchema = z.object({
  data: z.array(z.object({ id: z.string(), family_id: z.string(), version: z.number() })),
  version: z.object({ max: z.number().nullable() }).optional(),
});

const familyProductsSchema = z.object({
  data: z.object({ products: z.array(z.object({ id: z.string() })) }),
});

const inventorySchema = z.array(
  z.object({
    product_id: z.string(),
    current_inventory_level: z.number(),
    deleted_at: z.string().nullable().optional(),
  }),
);

export async function loadLightspeedFamilyPage(after: number, signal?: AbortSignal) {
  if (!/^[a-z0-9-]+$/i.test(env.LIGHTSPEED_DOMAIN_PREFIX))
    throw new Error("lightspeed_domain_prefix_invalid");
  const query = new URLSearchParams({ after: String(after), page_size: "200" });
  query.append("includes[]", "families");
  const page = pageSchema.parse(
    await requestJson(
      `https://${env.LIGHTSPEED_DOMAIN_PREFIX}.retail.lightspeed.app/api/2026-10/products?${query}`,
      { signal },
    ),
  );
  if (
    page.data.length &&
    (!page.version || page.version.max === null || page.version.max <= after)
  )
    throw new Error("lightspeed_cursor_did_not_advance");
  return {
    ids: page.data.map((p) => p.family_id),
    cursor: page.version?.max ?? after,
    count: page.data.length,
  };
}

export async function loadLightspeedFamilies(
  report?: ReportProgress,
): Promise<unknown[]> {
  if (!/^[a-z0-9-]+$/i.test(env.LIGHTSPEED_DOMAIN_PREFIX)) {
    throw new Error("lightspeed_domain_prefix_invalid");
  }
  const baseUrl = `https://${env.LIGHTSPEED_DOMAIN_PREFIX}.retail.lightspeed.app/api`;
  const familyIds = new Set<string>();
  let after = 0;
  let productsListed = 0;

  for (;;) {
    const query = new URLSearchParams({ after: String(after), page_size: "200" });
    query.append("includes[]", "families");
    const page = pageSchema.parse(
      await requestJson(`${baseUrl}/2026-10/products?${query.toString()}`),
    );
    if (page.data.length === 0) {
      break;
    }
    page.data.forEach((product) => familyIds.add(product.family_id));
    if (!page.version || page.version.max === null || page.version.max <= after) {
      throw new Error("lightspeed_cursor_did_not_advance");
    }
    after = page.version.max;
    productsListed += page.data.length;
    await report?.({ phase: "listing", completed: productsListed, total: null });
  }

  const families: unknown[] = [];
  await report?.({ phase: "downloading", completed: 0, total: familyIds.size });
  for (const familyId of familyIds) {
    families.push(await loadLightspeedFamily(familyId));
    await report?.({
      phase: "downloading",
      completed: families.length,
      total: familyIds.size,
    });
  }
  return families;
}

export async function loadLightspeedFamily(
  familyId: string,
  includeInventory = true,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!/^[a-z0-9-]+$/i.test(env.LIGHTSPEED_DOMAIN_PREFIX))
    throw new Error("lightspeed_domain_prefix_invalid");
  const baseUrl = `https://${env.LIGHTSPEED_DOMAIN_PREFIX}.retail.lightspeed.app/api`;
  const includes = new URLSearchParams();
  ["families", "brands", "categories", "tags", "variant_attributes"].forEach((include) =>
    includes.append("includes[]", include),
  );
  const family = await requestJson(
    `${baseUrl}/2026-10/product_families/${encodeURIComponent(familyId)}?${includes}`,
    { signal },
  );
  if (!includeInventory) return { ...(family as object), inventory: [] };
  const productIds = familyProductsSchema.parse(family).data.products.map(({ id }) => id);
  const inventory = (
    await Promise.all(
      productIds.map(async (productId) =>
        inventorySchema.parse(
          await requestJson(`${baseUrl}/2026-07/inventory`, {
            signal,
            method: "POST",
            body: JSON.stringify({
              include_deleted: false,
              product_id: productId,
              size: 5_000,
              sort_direction: "asc",
              variants: false,
            }),
          }),
        ),
      ),
    )
  ).flat();
  return { ...(family as object), inventory };
}

async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const signal = AbortSignal.any([
    AbortSignal.timeout(30_000),
    ...(init.signal ? [init.signal] : []),
  ]);
  try {
    const response = await fetch(url, {
      ...init,
      signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.LIGHTSPEED_ACCESS_TOKEN}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`lightspeed_request_failed:${response.status}`);
    }
    try {
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") throw error;
      throw new Error("lightspeed_response_invalid_json");
    }
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === "TimeoutError")) {
      throw new Error("lightspeed_request_timeout");
    }
    throw error;
  }
}

type ProductRow = Tables<"products">;
type LinkRow = Tables<"lightspeed_product_links">;

export class SupabaseCatalogReconciliationStore implements CatalogReconciliationStore {
  private readonly parser: ProductTitleParserService;
  private links: LinkRow[] | null = null;
  private linksTenantId: string | null = null;
  constructor(private readonly supabase: TypedSupabaseClient) {
    this.parser = new ProductTitleParserService(supabase);
  }

  private corrections: Map<string, FamilyCorrections> | null = null;
  private correctionsTenant: string | null = null;
  async getCorrections(tenantId: string, familyId: string): Promise<FamilyCorrections> {
    if (!this.corrections || this.correctionsTenant !== tenantId) {
      this.correctionsTenant = tenantId;
      this.corrections = new Map();
      for (let offset = 0; ; offset += 1000) {
        const page = await this.supabase
          .from("lightspeed_import_reviews")
          .select("family_id, corrections")
          .eq("tenant_id", tenantId)
          .order("family_id")
          .range(offset, offset + 999);
        if (page.error) {
          this.corrections = null;
          throw page.error;
        }
        for (const row of page.data ?? [])
          this.corrections.set(
            row.family_id,
            familyCorrectionsSchema.parse(row.corrections),
          );
        if (!page.data || page.data.length < 1000) break;
      }
    }
    return this.corrections.get(familyId) ?? {};
  }

  async updateProgress(runId: string, summary: ReconciliationSummary): Promise<void> {
    const { data, error } = await this.supabase
      .from("lightspeed_sync_runs")
      .update({ summary: { ...summary } })
      .eq("id", runId)
      .eq("status", "running")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Lightspeed run progress was not saved");
  }

  async startRun(
    tenantId: string,
    userId: string | null,
    scope?: "family",
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from("lightspeed_sync_runs")
      .insert({
        tenant_id: tenantId,
        started_by: userId,
        source_of_truth: "lightspeed",
        ...(scope ? { summary: { scope } } : {}),
        status: "running",
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      throw new Error("lightspeed_reconciliation_already_running");
    }
    if (error) throw error;
    return data.id;
  }

  private async loadLinks(tenantId: string) {
    if (!this.links || this.linksTenantId !== tenantId) {
      const links: LinkRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await this.supabase
          .from("lightspeed_product_links")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("id")
          .range(offset, offset + 999);
        if (result.error) throw result.error;
        links.push(...(result.data ?? []));
        if (!result.data || result.data.length < 1000) break;
      }
      this.links = links;
      this.linksTenantId = tenantId;
    }
    return this.links;
  }

  async updateUnavailableStock(
    tenantId: string,
    familyId: string,
    productIds: ReadonlySet<string>,
    remoteProductIds: ReadonlySet<string>,
  ): Promise<boolean> {
    const links = (await this.loadLinks(tenantId)).filter(
      (link) =>
        link.lightspeed_family_id === familyId &&
        link.lightspeed_product_id &&
        (productIds.has(link.lightspeed_product_id) ||
          !remoteProductIds.has(link.lightspeed_product_id)),
    );
    let changed = false;
    const variantIds = links.flatMap((link) =>
      link.variant_id ? [link.variant_id] : [],
    );
    if (variantIds.length) {
      const variants = await this.supabase
        .from("product_variants")
        .select("id,stock")
        .eq("tenant_id", tenantId)
        .in("id", variantIds);
      if (variants.error) throw variants.error;
      const changedIds = (variants.data ?? [])
        .filter((v) => v.stock !== 0)
        .map((v) => v.id);
      if (changedIds.length) {
        const updated = await this.supabase
          .from("product_variants")
          .update({ stock: 0 })
          .eq("tenant_id", tenantId)
          .in("id", changedIds);
        if (updated.error) throw updated.error;
        changed = true;
      }
    }
    for (const id of new Set(
      links.flatMap((link) => (link.product_id ? [link.product_id] : [])),
    )) {
      const variants = await this.supabase
        .from("product_variants")
        .select("stock")
        .eq("tenant_id", tenantId)
        .eq("product_id", id)
        .gt("stock", 0)
        .limit(1);
      if (variants.error) throw variants.error;
      if (!variants.data?.length) {
        const updated = await this.supabase
          .from("products")
          .update({ is_out_of_stock: true })
          .eq("tenant_id", tenantId)
          .eq("id", id)
          .eq("is_out_of_stock", false)
          .select("id");
        if (updated.error) throw updated.error;
        changed = changed || Boolean(updated.data?.length);
      }
    }
    return changed;
  }

  async applyFamily(
    runId: string,
    tenantId: string,
    families: CanonicalLightspeedFamily[],
    unavailableProductIds: ReadonlySet<string> = new Set(),
  ): Promise<"created" | "updated" | "skipped"> {
    if (!families.length) throw new Error("lightspeed_family_has_no_variants");
    await this.loadLinks(tenantId);
    const familyId = families[0].familyId;
    const originalProductIds = [
      ...new Set(
        this.links!.filter((link) => link.lightspeed_family_id === familyId).flatMap(
          (link) => (link.product_id ? [link.product_id] : []),
        ),
      ),
    ];
    const importedIds = new Set(
      families.flatMap((family) => family.variants.map((variant) => variant.productId)),
    );
    const allRemoteIds = new Set([...importedIds, ...unavailableProductIds]);
    let action: "created" | "updated" | "skipped" = "skipped";
    const listings = [];
    for (const family of families) {
      listings.push({
        family,
        prepared: await this.prepareListing(
          tenantId,
          family,
          originalProductIds,
          importedIds,
        ),
      });
    }
    const moves: Array<{ variant_id: string; product_id: string; size_label: string }> =
      [];
    for (const { family, prepared } of listings) {
      for (const variant of family.variants) {
        const link = this.links!.find(
          (item) =>
            item.lightspeed_family_id === familyId &&
            item.lightspeed_product_id === variant.productId,
        );
        if (link?.variant_id)
          moves.push({
            variant_id: link.variant_id,
            product_id: prepared.product.id,
            size_label: variant.sizeLabel,
          });
      }
    }
    if (moves.length) {
      const current = await this.supabase
        .from("product_variants")
        .select("id, product_id, size_label")
        .eq("tenant_id", tenantId)
        .in(
          "id",
          moves.map((move) => move.variant_id),
        );
      if (current.error) throw current.error;
      const changedMoves = moves.filter((move) =>
        current.data?.some(
          (row) =>
            row.id === move.variant_id &&
            (row.product_id !== move.product_id || row.size_label !== move.size_label),
        ),
      );
      if (changedMoves.length) {
        const moved = await this.supabase.rpc("move_lightspeed_variants", {
          p_tenant_id: tenantId,
          p_family_id: familyId,
          p_moves: changedMoves,
        });
        if (moved.error) throw moved.error;
        for (const move of changedMoves) {
          const link = this.links!.find((item) => item.variant_id === move.variant_id)!;
          link.product_id = move.product_id;
        }
        action = "updated";
      }
    }
    for (const { family, prepared } of listings) {
      const result = await this.applyListing(tenantId, family, allRemoteIds, prepared);
      if (result === "created" || (result === "updated" && action === "skipped"))
        action = result;
    }
    if (originalProductIds.length) {
      const products = await this.supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("id", originalProductIds);
      if (products.error) throw products.error;
      for (const product of products.data ?? []) {
        if (listings.some(({ prepared }) => prepared.product.id === product.id)) continue;
        if (
          this.links!.some(
            (link) =>
              link.product_id === product.id &&
              link.lightspeed_product_id &&
              unavailableProductIds.has(link.lightspeed_product_id),
          )
        )
          continue;
        if (product.archived_at && !product.is_active) continue;
        const archived = await this.supabase
          .from("products")
          .update({
            is_active: false,
            is_out_of_stock: true,
            archived_at: product.archived_at ?? new Date().toISOString(),
          })
          .eq("id", product.id)
          .eq("tenant_id", tenantId);
        if (archived.error) throw archived.error;
        const variants = await this.supabase
          .from("product_variants")
          .update({ stock: 0 })
          .eq("product_id", product.id)
          .eq("tenant_id", tenantId);
        if (variants.error) throw variants.error;
        const retired = await this.supabase
          .from("lightspeed_product_links")
          .update({ sync_state: "retired", tombstoned_at: new Date().toISOString() })
          .eq("product_id", product.id)
          .eq("tenant_id", tenantId);
        if (retired.error) throw retired.error;
        for (const link of this.links!) {
          if (link.product_id === product.id) link.sync_state = "retired";
        }
        if (action === "skipped") action = "updated";
      }
    }
    // Condition moves may empty a listing that retains an unavailable variant.
    if (
      unavailableProductIds.size &&
      (await this.updateUnavailableStock(
        tenantId,
        familyId,
        unavailableProductIds,
        allRemoteIds,
      ))
    ) {
      if (action === "skipped") action = "updated";
    }
    await this.recordItem(runId, tenantId, familyId, action, "applied", null);
    await this.resolveReview(tenantId, familyId);
    return action;
  }

  private async prepareListing(
    tenantId: string,
    family: CanonicalLightspeedFamily,
    candidateIds: string[],
    allRemoteIds: ReadonlySet<string>,
  ) {
    let created = false;
    let changed = false;
    let product: ProductRow | null = null;

    async function unusedSize(
      candidate: ProductRow,
      db: TypedSupabaseClient,
      links: LinkRow[],
    ) {
      const variants = await db
        .from("product_variants")
        .select("id, size_label")
        .eq("product_id", candidate.id)
        .eq("tenant_id", tenantId);
      if (variants.error) throw variants.error;
      return !variants.data?.some(
        (variant) =>
          family.variants.some((remote) => remote.sizeLabel === variant.size_label) &&
          !family.variants.some(
            (remote) =>
              variant.id === importIdentity(tenantId, "variant", remote.productId),
          ) &&
          !links.some(
            (link) =>
              link.variant_id === variant.id &&
              link.lightspeed_product_id &&
              allRemoteIds.has(link.lightspeed_product_id),
          ),
      );
    }
    if (candidateIds.length) {
      const result = await this.supabase
        .from("products")
        .select("*")
        .in("id", candidateIds)
        .eq("condition", family.condition)
        .eq("tenant_id", tenantId);
      if (result.error) throw result.error;
      for (const candidate of (result.data ?? []).sort(
        (a, b) => Number(b.is_active) - Number(a.is_active),
      )) {
        if (await unusedSize(candidate, this.supabase, this.links!)) {
          product = candidate;
          break;
        }
      }
    }
    // Stable identities recover inserts committed before the provider link was saved.
    // Occupied historical sizes may require a second listing, also with a repeatable ID.
    let newProductId = "";
    for (let generation = 0; !product; generation++) {
      newProductId = importIdentity(
        tenantId,
        "product",
        family.familyId,
        family.condition,
        String(generation),
      );
      const recovered = await this.supabase
        .from("products")
        .select("*")
        .eq("id", newProductId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (recovered.error) throw recovered.error;
      if (!recovered.data) break;
      if (await unusedSize(recovered.data, this.supabase, this.links!))
        product = recovered.data;
    }

    const parsed = await this.parser.parseTitle({
      titleRaw: family.name,
      category: family.category,
      tenantId,
    });
    const brand = parsed.brand.isVerified
      ? parsed.brand.label
      : family.brand || parsed.brand.label;
    if (!brand.trim()) throw new Error("mapping_required:brand");

    const productValues = {
      name: family.name,
      description: family.description,
      brand,
      model: parsed.model.label,
      category: family.category,
      condition: family.condition,
      size_type: family.sizeType,
      is_active: !family.archived,
      archived_at: family.archived
        ? (product?.archived_at ?? new Date().toISOString())
        : null,
      is_out_of_stock: family.variants.every(
        (variant) => !variant.active || variant.stock <= 0,
      ),
    };

    if (!product) {
      const result = await this.supabase
        .from("products")
        .insert({
          id: newProductId,
          tenant_id: tenantId,
          ...productValues,
          product_created_at: new Date().toISOString(),
          product_updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (result.error) throw result.error;
      product = result.data;
      created = true;
      changed = true;
    } else if (!matches(product, productValues)) {
      const result = await this.supabase
        .from("products")
        .update({ ...productValues, product_updated_at: new Date().toISOString() })
        .eq("id", product.id);
      if (result.error) throw result.error;
      changed = true;
    }

    return { product: product!, parsed, brand, created, changed };
  }

  private async applyListing(
    tenantId: string,
    family: CanonicalLightspeedFamily,
    allRemoteIds: ReadonlySet<string>,
    prepared: Awaited<ReturnType<SupabaseCatalogReconciliationStore["prepareListing"]>>,
  ): Promise<"created" | "updated" | "skipped"> {
    const allLinks = this.links!;

    const familyLinks = (allLinks ?? []).filter(
      (link) => link.lightspeed_family_id === family.familyId,
    );
    const { product, parsed, brand, created } = prepared;
    const productId = product.id;
    let changed = prepared.changed;

    const variantsResult = await this.supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId!);
    if (variantsResult.error) throw variantsResult.error;
    const localVariants = variantsResult.data ?? [];

    for (const [sortOrder, remote] of family.variants.entries()) {
      const linked = familyLinks.find(
        (link) => link.lightspeed_product_id === remote.productId,
      );
      const collision = (allLinks ?? []).find(
        (link) =>
          link.external_sku.toLowerCase() === remote.sku.toLowerCase() &&
          link.lightspeed_product_id !== remote.productId,
      );
      if (collision) {
        throw new Error(`lightspeed_sku_identity_conflict:${remote.sku}`);
      }

      const variantId =
        linked?.variant_id ?? importIdentity(tenantId, "variant", remote.productId);
      let local = localVariants.find((variant) => variant.id === variantId);
      if (!local) {
        const existing = await this.supabase
          .from("product_variants")
          .select("*")
          .eq("id", variantId)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (existing.error) throw existing.error;
        local = existing.data ?? undefined;
      }
      local ??= localVariants.find(
        (variant) => variant.sku.toLowerCase() === remote.sku.toLowerCase(),
      );
      const variantValues = {
        product_id: productId!,
        sku: remote.sku,
        size_label: remote.sizeLabel,
        sale_price_cents: remote.salePriceCents,
        unit_cost_cents: remote.unitCostCents,
        stock: remote.active ? remote.stock : 0,
        sort_order: sortOrder,
      };

      if (!local) {
        const result = await this.supabase
          .from("product_variants")
          .insert({
            id: importIdentity(tenantId, "variant", remote.productId),
            tenant_id: tenantId,
            ...variantValues,
          })
          .select()
          .single();
        if (result.error) throw result.error;
        local = result.data;
        changed = true;
      } else if (!matches(local, variantValues)) {
        const result = await this.supabase
          .from("product_variants")
          .update(variantValues)
          .eq("id", local.id);
        if (result.error) throw result.error;
        changed = true;
      }

      await this.saveLink(linked, {
        tenant_id: tenantId,
        product_id: productId,
        variant_id: local.id,
        lightspeed_family_id: family.familyId,
        lightspeed_product_id: remote.productId,
        lightspeed_variant_id: remote.productId,
        external_sku: remote.sku,
        sync_state: "linked",
        tombstoned_at: null,
        last_error: null,
        last_sync_direction: "lightspeed_to_website",
        last_lightspeed_modified_at: new Date().toISOString(),
      });
    }

    for (const link of familyLinks) {
      if (
        link.lightspeed_product_id &&
        link.product_id === productId &&
        link.sync_state !== "retired" &&
        !allRemoteIds.has(link.lightspeed_product_id)
      ) {
        if (link.variant_id) {
          const result = await this.supabase
            .from("product_variants")
            .update({ stock: 0 })
            .eq("id", link.variant_id);
          if (result.error) throw result.error;
        }
        const result = await this.supabase
          .from("lightspeed_product_links")
          .update({
            sync_state: "retired",
            tombstoned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", link.id);
        if (result.error) throw result.error;
        link.sync_state = "retired";
        changed = true;
      }
    }

    changed = (await this.syncImages(productId!, family.images)) || changed;
    changed =
      (await this.syncTags(
        productId!,
        tenantId,
        buildAutoProductTags({
          brandLabel: brand,
          brandGroupKey: parsed.brand.groupKey,
          modelLabel: parsed.model.label,
          category: family.category,
          condition: family.condition,
          sizeType: family.sizeType,
          variants: family.variants.map((variant) => ({
            size_label: variant.sizeLabel,
            stock: variant.active ? variant.stock : 0,
          })),
        }).filter(
          (tag) =>
            !(product?.excluded_auto_tag_keys ?? []).includes(
              `${tag.group_key}:${tag.label}`,
            ),
        ),
      )) || changed;
    const action = created ? "created" : changed ? "updated" : "skipped";
    return action;
  }

  async retireMissingFamilies(
    runId: string,
    tenantId: string,
    remoteFamilyIds: ReadonlySet<string>,
    onlyFamilyId?: string,
  ): Promise<number> {
    const data: LinkRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = this.supabase
        .from("lightspeed_product_links")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("sync_state", "linked")
        .order("id")
        .range(offset, offset + 999);
      if (onlyFamilyId) query = query.eq("lightspeed_family_id", onlyFamilyId);
      const page = await query;
      if (page.error) throw page.error;
      data.push(...(page.data ?? []));
      if (!page.data || page.data.length < 1000) break;
    }
    const missing = new Map<string, LinkRow[]>();
    for (const link of data ?? []) {
      if (link.lightspeed_family_id && !remoteFamilyIds.has(link.lightspeed_family_id)) {
        missing.set(link.lightspeed_family_id, [
          ...(missing.get(link.lightspeed_family_id) ?? []),
          link,
        ]);
      }
    }

    for (const [familyId, links] of missing) {
      const productIds = [
        ...new Set(links.flatMap((link) => (link.product_id ? [link.product_id] : []))),
      ];
      if (productIds.length > 0) {
        const products = await this.supabase
          .from("products")
          .update({
            archived_at: new Date().toISOString(),
            is_active: false,
            is_out_of_stock: true,
            product_updated_at: new Date().toISOString(),
          })
          .in("id", productIds);
        if (products.error) throw products.error;
        const variants = await this.supabase
          .from("product_variants")
          .update({ stock: 0 })
          .in("product_id", productIds);
        if (variants.error) throw variants.error;
      }
      const retired = await this.supabase
        .from("lightspeed_product_links")
        .update({
          sync_state: "retired",
          tombstoned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in(
          "id",
          links.map((link) => link.id),
        );
      if (retired.error) throw retired.error;
      await this.recordItem(runId, tenantId, familyId, "retire", "applied", null);
      await this.resolveReview(tenantId, familyId);
    }
    return missing.size;
  }

  async recordFailure(
    runId: string,
    entityKey: string,
    reason: string,
    raw?: unknown,
  ): Promise<void> {
    const { data: run, error } = await this.supabase
      .from("lightspeed_sync_runs")
      .select("tenant_id")
      .eq("id", runId)
      .single();
    if (error) throw error;
    await this.recordItem(runId, run.tenant_id, entityKey, "skip", "failed", reason);
    const saved = await this.supabase.from("lightspeed_import_reviews").upsert(
      {
        tenant_id: run.tenant_id,
        family_id: entityKey,
        error: reason,
        resolved: false,
        ...(raw ? { source_payload: raw as Json } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,family_id" },
    );
    if (saved.error) throw saved.error;
  }

  async resolveReview(tenantId: string, familyId: string) {
    const result = await this.supabase
      .from("lightspeed_import_reviews")
      .update({ resolved: true, error: null, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("family_id", familyId);
    if (result.error) throw result.error;
  }

  async finishRun(
    runId: string,
    status: "success" | "partial_failure" | "failed",
    summary: ReconciliationSummary,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("lightspeed_sync_runs")
      .update({
        status,
        summary: { ...summary },
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Lightspeed run completion was not saved");
  }

  private async saveLink(
    existing: LinkRow | undefined,
    values: Omit<
      LinkRow,
      | "id"
      | "created_at"
      | "updated_at"
      | "lightspeed_inventory_item_id"
      | "last_website_modified_at"
    >,
  ) {
    const result = existing
      ? await this.supabase
          .from("lightspeed_product_links")
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select()
          .single()
      : await this.supabase
          .from("lightspeed_product_links")
          .insert(values)
          .select()
          .single();
    if (result.error) throw result.error;
    if (this.links && result.data) {
      const index = this.links.findIndex((link) => link.id === result.data.id);
      if (index < 0) this.links.push(result.data);
      else this.links[index] = result.data;
    }
  }

  private async syncTags(
    productId: string,
    tenantId: string,
    desired: Parameters<typeof upsertTags>[1]["tags"],
  ): Promise<boolean> {
    const tags = await upsertTags(this.supabase, { tenantId, tags: desired });
    const current = await this.supabase
      .from("product_tags")
      .select("tag_id, tag:tags(id, group_key)")
      .eq("product_id", productId);
    if (current.error) throw current.error;
    const autoGroups = new Set([
      "brand",
      "designer_brand",
      "model",
      "category",
      "condition",
      "size_shoe",
      "size_clothing",
      "size_custom",
      "size_none",
    ]);
    const ids = new Set(tags.map((tag) => tag.id));
    const remove = (current.data ?? [])
      .filter(
        (link) => link.tag && autoGroups.has(link.tag.group_key) && !ids.has(link.tag_id),
      )
      .map((link) => link.tag_id);
    const add = tags.filter(
      (tag) => !(current.data ?? []).some((link) => link.tag_id === tag.id),
    );
    if (add.length) {
      const result = await this.supabase.from("product_tags").upsert(
        add.map((tag) => ({ product_id: productId, tag_id: tag.id })),
        { onConflict: "product_id,tag_id" },
      );
      if (result.error) throw result.error;
    }
    if (remove.length) {
      const result = await this.supabase
        .from("product_tags")
        .delete()
        .eq("product_id", productId)
        .in("tag_id", remove);
      if (result.error) throw result.error;
    }
    return add.length > 0 || remove.length > 0;
  }

  private async syncImages(
    productId: string,
    images: CanonicalLightspeedFamily["images"],
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("product_images")
      .select("url, sort_order, is_primary")
      .eq("product_id", productId)
      .order("sort_order");
    if (error) throw error;
    const desired = images.map((image) => ({
      url: image.url,
      sort_order: image.position,
      is_primary: image.position === 0,
    }));
    if (JSON.stringify(data ?? []) === JSON.stringify(desired)) {
      return false;
    }
    const deleted = await this.supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);
    if (deleted.error) throw deleted.error;
    if (desired.length > 0) {
      const inserted = await this.supabase
        .from("product_images")
        .insert(desired.map((image) => ({ product_id: productId, ...image })));
      if (inserted.error) throw inserted.error;
    }
    return true;
  }

  private async recordItem(
    runId: string,
    tenantId: string,
    entityKey: string,
    action: string,
    applyStatus: string,
    failureReason: string | null,
  ) {
    const { error } = await this.supabase.from("lightspeed_sync_run_items").insert({
      sync_run_id: runId,
      tenant_id: tenantId,
      change_type: action,
      action,
      entity_type: "product_family",
      entity_key: entityKey,
      payload: {} as Json,
      approved: true,
      apply_status: applyStatus,
      failure_reason: failureReason,
    });
    if (error) throw error;
  }
}

function matches<T extends object>(row: T, expected: Partial<T>): boolean {
  return Object.entries(expected).every(([key, value]) =>
    Object.is(row[key as keyof T], value),
  );
}

function importIdentity(...parts: string[]): string {
  const bytes = createHash("sha256")
    .update(JSON.stringify(["lightspeed", ...parts]))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
