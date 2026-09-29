import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const path = new URL("../../.github/workflows/production.yml", import.meta.url);

test("release validation accepts stable and numbered alpha/beta tags only", async () => {
  const workflow = await readFile(path, "utf8");
  const validation = workflow.match(
    /          if \[\[ ! "\$GITHUB_REF_NAME"[\s\S]*?          fi/,
  );
  assert.ok(validation, "release tag validation must exist");
  const bash =
    process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";

  for (const [tag, status] of [
    ["v1.2.3", 0],
    ["v0.0.0", 0],
    ["v1.2.3-alpha.0", 0],
    ["v1.2.3-beta.12", 0],
    ["v1.2.3-alpha", 1],
    ["v1.2.3-beta.x", 1],
    ["v1.2.3-beta.01", 1],
    ["v01.2.3", 1],
    ["v1.2.3-rc.1", 1],
    ["v1.2.3-beta.1.extra", 1],
    ["1.2.3-alpha.1", 1],
  ]) {
    const result = spawnSync(bash, ["-c", validation[0]], {
      env: { ...process.env, GITHUB_REF_NAME: tag },
      encoding: "utf8",
    });
    assert.ifError(result.error);
    assert.equal(result.status, status, `${tag}: ${result.stderr}`);
  }
});

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
