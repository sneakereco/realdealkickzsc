import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const path = new URL("../../.github/workflows/production.yml", import.meta.url);

test("semantic tags deploy production only from main history", async () => {
  const workflow = await readFile(path, "utf8");
  const buildIndex = workflow.indexOf("vercel@59.16.0 build --prod");
  const deployIndex = workflow.indexOf("vercel@59.16.0 deploy --prebuilt --prod");

  assert.match(workflow, /tags:\s*\n\s*- "v\*\.\*\.\*"/);
  assert.match(workflow, /git merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/);
  assert.match(workflow, /GITHUB_REF_NAME/);
  assert.match(workflow, /^  validate-release:/m);
  assert.match(workflow, /^  migrate:/m);
  assert.match(workflow, /^  deploy:/m);
  assert.match(workflow, /^  verify:/m);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /dopplerhq\/secrets-fetch-action@451892f/);
  assert.match(workflow, /supabase db push --db-url "\$SUPABASE_DB_URL"/);
  assert.match(workflow, /npx --yes vercel@59\.16\.0/);
  assert.ok(buildIndex >= 0, "production must build Vercel artifacts in GitHub Actions");
  assert.ok(
    deployIndex > buildIndex,
    "production must deploy prebuilt artifacts after building",
  );
  assert.match(workflow, /\/api\/readyz/);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /\|\| echo/);
});
