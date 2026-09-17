import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const sourceRoot = new URL("src/", root);

async function sourceFiles(directory = sourceRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
      return entry.isDirectory() ? sourceFiles(url) : [url];
    }),
  );
  return nested.flat();
}

test("Next entrypoints stay in src/app and src/proxy.ts", async () => {
  await access(new URL("src/app/", root));
  await access(new URL("src/proxy.ts", root));
  await assert.rejects(access(new URL("src/pages/", root)));
  await assert.rejects(access(new URL("src/middleware.ts", root)));
});

test("route adapters use capability-owned modules", async () => {
  const files = await sourceFiles(new URL("src/app/", root));
  const routeSource = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");

  assert.doesNotMatch(
    routeSource,
    /@\/(?:components\/analytics|components\/admin|lib\/lightspeed|repositories\/(?:catalog|product)-repo|services\/(?:admin-auth|storefront)-service)/,
  );

  for (const capability of ["catalog", "lightspeed", "admin", "analytics"])
    assert.match(routeSource, new RegExp(`@/modules/${capability}(?:/|\")`));
});

test("legacy capability locations are removed", async () => {
  for (const path of [
    "src/lib/lightspeed/",
    "src/components/analytics/",
    "src/services/admin-auth-service.ts",
    "src/services/storefront-service.ts",
    "src/repositories/catalog-repo.ts",
    "src/repositories/product-repo.ts",
  ]) {
    await assert.rejects(access(new URL(path, root)), path);
  }
});
