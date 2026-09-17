import assert from "node:assert/strict";
import test from "node:test";

import * as adminProductsRoute from "../src/app/api/admin/products/route";
import { ProductRepository } from "../src/repositories/product-repo";

void test("admin products API exposes reads but no catalog mutations", () => {
  assert.equal(typeof adminProductsRoute.GET, "function");
  assert.equal("POST" in adminProductsRoute, false);
  assert.equal("PATCH" in adminProductsRoute, false);
  assert.equal("PUT" in adminProductsRoute, false);
  assert.equal("DELETE" in adminProductsRoute, false);
});

void test("the internal repository still supports authoritative sync writes", async () => {
  let insertedName = "";
  const row = {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Sync-owned product",
  };
  const supabase = {
    from(table: string) {
      assert.equal(table, "products");
      return {
        insert(payload: { name: string }) {
          insertedName = payload.name;
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: row, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const repository = new ProductRepository(
    supabase as unknown as ConstructorParameters<typeof ProductRepository>[0],
  );
  const result = await repository.create({
    name: row.name,
  } as Parameters<ProductRepository["create"]>[0]);

  assert.equal(insertedName, row.name);
  assert.equal(result, row);
});
