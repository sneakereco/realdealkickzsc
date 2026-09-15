import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const path = new URL("../../.github/workflows/staging.yml", import.meta.url);
const packagePath = new URL("../../package.json", import.meta.url);

test("main deploys to staging through ordered jobs", async () => {
  const workflow = await readFile(path, "utf8");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  const buildIndex = workflow.indexOf("vercel@59.16.0 build --prod");
  const deployIndex = workflow.indexOf("vercel@59.16.0 deploy --prebuilt --prod");

  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/);
  assert.doesNotMatch(workflow, /branches:\s*\n\s*- staging/);
  assert.match(workflow, /^  validate:/m);
  assert.match(workflow, /^  migrate:/m);
  assert.match(workflow, /^  deploy:/m);
  assert.match(workflow, /^  verify:/m);
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /dopplerhq\/secrets-fetch-action@451892f/);
  assert.match(workflow, /supabase db push --db-url "\$SUPABASE_DB_URL"/);
  assert.match(workflow, /npx --yes vercel@59\.16\.0/);
  assert.equal(packageJson.scripts.build, "next build");
  assert.ok(buildIndex >= 0, "staging must build Vercel artifacts in GitHub Actions");
  assert.ok(
    deployIndex > buildIndex,
    "staging must deploy prebuilt artifacts after building",
  );
  assert.match(workflow, /\/api\/readyz/);
  assert.doesNotMatch(workflow, /seed\.sql|--include-seed/);
  assert.doesNotMatch(workflow, /npm i(?:nstall)? -g vercel/);
  assert.doesNotMatch(workflow, /\|\| echo/);
});
