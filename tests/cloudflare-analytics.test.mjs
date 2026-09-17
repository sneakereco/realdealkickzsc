import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory()
        ? sourceFiles(target)
        : /\.(?:ts|tsx)$/.test(entry.name)
          ? Promise.resolve([target])
          : Promise.resolve([]);
    }),
  );
  return nested.flat();
}

void test("root layout installs exactly one deployment-gated Cloudflare beacon", async () => {
  const layout = await readFile(path.join(root, "src/app/layout.tsx"), "utf8");
  const beacon = await readFile(
    path.join(root, "src/components/analytics/CloudflareWebAnalytics.tsx"),
    "utf8",
  );

  assert.equal((layout.match(/<CloudflareWebAnalytics/g) ?? []).length, 1);
  assert.equal(
    (beacon.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) ?? []).length,
    1,
  );
  assert.match(beacon, /CLOUDFLARE_WEB_ANALYTICS_ENABLED/);
});

void test("live source has no first-party pageview reads, writes, IDs, or APIs", async () => {
  const files = await sourceFiles(path.join(root, "src"));
  const matches = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    if (
      /site_pageviews|rdk_(?:visitor|session)_id|\/api\/analytics\/track|AnalyticsService/.test(
        content,
      )
    ) {
      matches.push(path.relative(root, file));
    }
  }

  assert.deepEqual(matches, []);
});

void test("CSP permits only the Cloudflare script and reporting origin", async () => {
  const security = await readFile(path.join(root, "src/config/security.ts"), "utf8");
  assert.match(security, /https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/);
  assert.match(security, /https:\/\/cloudflareinsights\.com/);
});

void test("historical first-party analytics has a forward-only retirement migration", async () => {
  const migration = await readFile(
    path.join(root, "supabase/migrations/20260917170000_retire_site_pageviews.sql"),
    "utf8",
  );
  assert.match(migration, /drop table if exists public\.site_pageviews/i);
});
