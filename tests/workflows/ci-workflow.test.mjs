import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const path = new URL("../../.github/workflows/ci.yml", import.meta.url);

test("pull-request CI validates main without deployment secrets", async () => {
  const workflow = await readFile(path, "utf8");

  assert.match(workflow, /pull_request:\s*\n\s*branches:\s*\n\s*- main/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /npm run format:check/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run build/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /environment:\s*(staging|production)/);
});
