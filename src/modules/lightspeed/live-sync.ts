import "server-only";

import { z } from "zod";
import { env } from "@/config/env";
import {
  createSupabaseAdminClient,
  type AdminSupabaseClient,
} from "@/lib/supabase/service-role";
import { reconcileFamily, type ReconciliationSummary } from "./reconciliation";
import { loadLightspeedFamily, SupabaseCatalogReconciliationStore } from "./server";

const productSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    family_id: z.string().min(1),
    active: z.object({ in_store: z.boolean() }),
    deleted_at: z.string().nullish(),
  }),
});
const inventorySchema = z.array(
  z.object({
    product_id: z.string(),
    current_inventory_level: z.number().finite(),
    deleted_at: z.string().nullish(),
  }),
);

// Events identify work only. Catalog values always come from authenticated API reads.
export async function runLiveSync(
  tenantId: string,
  event: { topic: string; resource_id: string | null },
  db?: AdminSupabaseClient,
) {
  const signal = AbortSignal.timeout(240_000);
  const client = db ?? createSupabaseAdminClient(signal);
  const store = new SupabaseCatalogReconciliationStore(client);
  // Reuse the existing tenant mutex and hidden family scope. Never enqueue a full scan.
  const runId = await store.startRun(tenantId, null, "family");
  const summary: ReconciliationSummary = {
    scope: "family",
    created: 0,
    updated: 0,
    retired: 0,
    skipped: 0,
    failed: 0,
  };
  // Cleanup must still work after a provider deadline, to release the tenant mutex.
  const cleanup = new SupabaseCatalogReconciliationStore(
    db ?? createSupabaseAdminClient(),
  );
  try {
    if (!event.resource_id) throw new Error("webhook_resource_missing");
    let ids = [event.resource_id];
    if (event.topic === "sale.update") {
      const sale = z
        .object({
          data: z.object({
            line_items: z.array(
              z.object({ product: z.object({ id: z.string().min(1) }) }),
            ),
          }),
        })
        .parse(
          await readProvider(
            `/2026-07/sales/${encodeURIComponent(event.resource_id)}`,
            signal,
          ),
        );
      ids = [...new Set(sale.data.line_items.map((item) => item.product.id))];
    } else if (!["product.update", "inventory.update"].includes(event.topic)) {
      throw new Error("webhook_type_invalid");
    }
    const families = new Set<string>();
    for (const id of ids) {
      signal.throwIfAborted();
      const product = productSchema.parse(
        await readProvider(`/2026-10/products/${encodeURIComponent(id)}`, signal),
      ).data;
      if (product.id !== id) throw new Error("lightspeed_product_identity_mismatch");
      const link = await client
        .from("lightspeed_product_links")
        .select("product_id, variant_id, sync_state")
        .eq("tenant_id", tenantId)
        .eq("lightspeed_product_id", id)
        .maybeSingle();
      if (link.error) throw link.error;
      if (
        event.topic === "product.update" ||
        !link.data?.variant_id ||
        link.data.sync_state !== "linked" ||
        product.deleted_at
      ) {
        if (families.has(product.family_id)) continue;
        families.add(product.family_id);
        const raw = await loadLightspeedFamily(product.family_id, true, signal);
        const keep = await reconcileFamily(raw, runId, tenantId, store, summary);
        if (!keep)
          summary.retired += await store.retireMissingFamilies(
            runId,
            tenantId,
            new Set(),
            product.family_id,
          );
        continue;
      }
      const inventory = inventorySchema.parse(
        await readProvider("/2026-07/inventory", signal, {
          method: "POST",
          body: JSON.stringify({
            product_id: id,
            include_deleted: false,
            variants: false,
            size: 5000,
            sort_direction: "asc",
          }),
        }),
      );
      // Refuse a potentially truncated aggregate instead of silently understating stock.
      if (inventory.length >= 5000) throw new Error("lightspeed_inventory_page_limit");
      const rows = inventory.filter((row) => row.product_id === id && !row.deleted_at);
      if (!rows.length) throw new Error(`inventory_unavailable:${id}`);
      const stock = product.active.in_store
        ? Math.max(
            0,
            Math.trunc(rows.reduce((sum, row) => sum + row.current_inventory_level, 0)),
          )
        : 0;
      if (!Number.isSafeInteger(stock)) throw new Error("lightspeed_inventory_invalid");
      const updated = await client
        .from("product_variants")
        .update({ stock })
        .eq("tenant_id", tenantId)
        .eq("id", link.data.variant_id)
        .eq("product_id", link.data.product_id!)
        .select("id");
      if (updated.error) throw updated.error;
      if (!updated.data?.length) throw new Error("lightspeed_variant_link_missing");
      const available = await client
        .from("product_variants")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("product_id", link.data.product_id!)
        .gt("stock", 0)
        .limit(1);
      if (available.error) throw available.error;
      const visibility = await client
        .from("products")
        .update({ is_out_of_stock: !available.data?.length })
        .eq("tenant_id", tenantId)
        .eq("id", link.data.product_id!);
      if (visibility.error) throw visibility.error;
      summary.updated++;
    }
    if (summary.failed)
      throw new Error(
        summary.failure_groups?.[0]?.reason ?? "lightspeed_live_family_failed",
      );
    await cleanup.finishRun(runId, "success", summary);
    return { run_id: runId, ...summary };
  } catch (error) {
    summary.error =
      error instanceof Error
        ? error.message.slice(0, 300)
        : "lightspeed_live_sync_failed";
    await cleanup.finishRun(runId, "failed", summary);
    throw error;
  }
}

async function readProvider(path: string, signal: AbortSignal, init: RequestInit = {}) {
  if (!/^[a-z0-9-]+$/i.test(env.LIGHTSPEED_DOMAIN_PREFIX))
    throw new Error("lightspeed_domain_prefix_invalid");
  const response = await fetch(
    `https://${env.LIGHTSPEED_DOMAIN_PREFIX}.retail.lightspeed.app/api${path}`,
    {
      ...init,
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.LIGHTSPEED_ACCESS_TOKEN}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    },
  );
  if (!response.ok) throw new Error(`lightspeed_live_request_failed:${response.status}`);
  return response.json() as Promise<unknown>;
}
