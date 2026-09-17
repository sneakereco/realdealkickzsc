import "server-only";

import { z } from "zod";

import { env } from "@/config/env";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/db/database.types";

import type {
  CanonicalLightspeedFamily,
  CatalogReconciliationStore,
  ReconciliationSummary,
} from "./reconciliation";

const pageSchema = z.object({
  data: z.array(z.object({ id: z.string(), family_id: z.string(), version: z.number() })),
  version: z.object({ max: z.number().nullable() }),
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

export async function loadLightspeedFamilies(): Promise<unknown[]> {
  if (!/^[a-z0-9-]+$/i.test(env.LIGHTSPEED_DOMAIN_PREFIX)) {
    throw new Error("lightspeed_domain_prefix_invalid");
  }
  const baseUrl = `https://${env.LIGHTSPEED_DOMAIN_PREFIX}.retail.lightspeed.app/api`;
  const familyIds = new Set<string>();
  let after = 0;

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
    if (page.version.max === null || page.version.max <= after) {
      throw new Error("lightspeed_cursor_did_not_advance");
    }
    after = page.version.max;
  }

  const families: unknown[] = [];
  for (const familyId of familyIds) {
    const includes = new URLSearchParams();
    ["families", "brands", "categories", "tags", "variant_attributes"].forEach(
      (include) => includes.append("includes[]", include),
    );
    const family = await requestJson(
      `${baseUrl}/2026-10/product_families/${encodeURIComponent(familyId)}?${includes}`,
    );
    const productIds = familyProductsSchema
      .parse(family)
      .data.products.map(({ id }) => id);
    const inventory = (
      await Promise.all(
        productIds.map(async (productId) =>
          inventorySchema.parse(
            await requestJson(`${baseUrl}/2026-07/inventory`, {
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
    families.push({ ...(family as object), inventory });
  }
  return families;
}

async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
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
  } catch {
    throw new Error("lightspeed_response_invalid_json");
  }
}

type ProductRow = Tables<"products">;
type LinkRow = Tables<"lightspeed_product_links">;

export class SupabaseCatalogReconciliationStore implements CatalogReconciliationStore {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async startRun(tenantId: string, userId: string | null): Promise<string> {
    const { data, error } = await this.supabase
      .from("lightspeed_sync_runs")
      .insert({
        tenant_id: tenantId,
        started_by: userId,
        source_of_truth: "lightspeed",
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

  async applyFamily(
    runId: string,
    tenantId: string,
    family: CanonicalLightspeedFamily,
  ): Promise<"created" | "updated" | "skipped"> {
    const { data: allLinks, error: linksError } = await this.supabase
      .from("lightspeed_product_links")
      .select("*")
      .eq("tenant_id", tenantId);
    if (linksError) throw linksError;

    const familyLinks = (allLinks ?? []).filter(
      (link) => link.lightspeed_family_id === family.familyId,
    );
    let productId = familyLinks.find((link) => link.product_id)?.product_id ?? null;
    let created = false;
    let changed = false;
    let product: ProductRow | null = null;

    if (productId) {
      const result = await this.supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (result.error) throw result.error;
      product = result.data;
    }

    const productValues = {
      name: family.name,
      description: family.description,
      brand: family.brand,
      model: family.model,
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
          tenant_id: tenantId,
          ...productValues,
          product_created_at: new Date().toISOString(),
          product_updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (result.error) throw result.error;
      product = result.data;
      productId = product.id;
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

    const variantsResult = await this.supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId!);
    if (variantsResult.error) throw variantsResult.error;
    const localVariants = variantsResult.data ?? [];
    const activeRemoteIds = new Set(family.variants.map((variant) => variant.productId));

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

      let local = linked?.variant_id
        ? localVariants.find((variant) => variant.id === linked.variant_id)
        : undefined;
      local ??= localVariants.find(
        (variant) => variant.sku.toLowerCase() === remote.sku.toLowerCase(),
      );
      const variantValues = {
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
          .insert({ tenant_id: tenantId, product_id: productId!, ...variantValues })
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
        !activeRemoteIds.has(link.lightspeed_product_id)
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
        changed = true;
      }
    }

    changed = (await this.syncImages(productId!, family.images)) || changed;
    const action = created ? "created" : changed ? "updated" : "skipped";
    await this.recordItem(runId, tenantId, family.familyId, action, "applied", null);
    return action;
  }

  async retireMissingFamilies(
    runId: string,
    tenantId: string,
    remoteFamilyIds: ReadonlySet<string>,
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from("lightspeed_product_links")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("sync_state", "linked");
    if (error) throw error;
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
    }
    return missing.size;
  }

  async recordFailure(runId: string, entityKey: string, reason: string): Promise<void> {
    const { data: run, error } = await this.supabase
      .from("lightspeed_sync_runs")
      .select("tenant_id")
      .eq("id", runId)
      .single();
    if (error) throw error;
    await this.recordItem(runId, run.tenant_id, entityKey, "skip", "failed", reason);
  }

  async finishRun(
    runId: string,
    status: "success" | "partial_failure" | "failed",
    summary: ReconciliationSummary,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("lightspeed_sync_runs")
      .update({ status, summary: { ...summary }, completed_at: new Date().toISOString() })
      .eq("id", runId);
    if (error) throw error;
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
      : await this.supabase.from("lightspeed_product_links").insert(values);
    if (result.error) throw result.error;
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
