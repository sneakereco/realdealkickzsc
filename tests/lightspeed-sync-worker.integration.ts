// doppler run -- node --conditions=react-server --import tsx tests/lightspeed-sync-worker.integration.ts
// Uses the local database and a provider fixture; never contacts Lightspeed or hosted Supabase.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { createSupabaseAdminClient } from "../src/lib/supabase/service-role";

async function main() {
  // Match Next's server build alias when running the integration test outside Next.
  registerHooks({
    resolve: (specifier, context, next) =>
      next(
        specifier === "server-only"
          ? "next/dist/compiled/server-only/empty.js"
          : specifier,
        context,
      ),
  });
  const { enqueueSync, workSync } = await import("../src/modules/lightspeed/sync-jobs");
  const databaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(databaseUrl.hostname),
    "Local database required",
  );
  const raw = JSON.parse(
    await readFile(
      new URL("./fixtures/lightspeed/manual-reconciliation.json", import.meta.url),
      "utf8",
    ),
  );
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname.endsWith(".retail.lightspeed.app")) {
      if (url.pathname.endsWith("/products"))
        return Promise.resolve(
          Response.json(
            url.searchParams.get("after") === "0"
              ? {
                  data: [{ id: "product-10", family_id: "family-1", version: 10 }],
                  version: { max: 10 },
                }
              : { data: [] },
          ),
        );
      if (url.pathname.endsWith("/product_families/family-1"))
        return Promise.resolve(Response.json(raw));
      if (url.pathname.endsWith("/inventory"))
        return Promise.resolve(Response.json(raw.inventory));
      return Promise.reject(
        new Error(`Unexpected provider fixture route: ${url.pathname}`),
      );
    }
    assert.equal(url.origin, databaseUrl.origin, "Unexpected network destination");
    return realFetch(input, init);
  };
  const db = createSupabaseAdminClient();
  const tenantId = randomUUID();
  try {
    const tenant = await db
      .from("tenants")
      .insert({ id: tenantId, name: "Disposable sync integration test" });
    if (tenant.error) throw tenant.error;
    const run = await enqueueSync(tenantId, null, db);
    await workSync(run.id, db);
    const result = await db
      .from("lightspeed_sync_runs")
      .select("status, summary, checkpoint")
      .eq("id", run.id)
      .single();
    if (result.error) throw result.error;
    assert.equal(result.data.status, "success", JSON.stringify(result.data.summary));
    assert.equal((result.data.summary as { created: number }).created, 1);
    const variants = await db
      .from("product_variants")
      .select("sku, stock, sale_price_cents")
      .eq("tenant_id", tenantId);
    if (variants.error) throw variants.error;
    assert.deepEqual(variants.data, [
      { sku: "RDK-AJ1-BRED-10", stock: 2, sale_price_cents: 18999 },
    ]);
    const replay = await enqueueSync(tenantId, null, db);
    await workSync(replay.id, db);
    const products = await db.from("products").select("id").eq("tenant_id", tenantId);
    if (products.error) throw products.error;
    assert.equal(products.data.length, 1, "Replay must not duplicate products");
    console.info(
      "PASS: real local database enqueue, worker, completion, stock/price, and repeat import",
    );
  } finally {
    const cleanup = await db.from("tenants").delete().eq("id", tenantId);
    globalThis.fetch = realFetch;
    if (cleanup.error) throw cleanup.error;
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
