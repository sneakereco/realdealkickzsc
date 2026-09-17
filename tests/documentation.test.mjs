import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("current documentation links the architecture and operator runbook", async () => {
  const [readme, architecture, runbook] = await Promise.all([
    read("README.md"),
    read("docs/ARCHITECTURE.md"),
    read("docs/LIGHTSPEED_RUNBOOK.md"),
  ]);

  assert.match(readme, /docs\/ARCHITECTURE\.md/);
  assert.match(readme, /docs\/LIGHTSPEED_RUNBOOK\.md/);
  assert.match(architecture, /Lightspeed is authoritative/i);
  assert.match(runbook, /needs_attention/);
});

test("documented npm commands map to checked-in scripts", async () => {
  const [readme, onboarding, packageText] = await Promise.all([
    read("README.md"),
    read("docs/DEVELOPER_ONBOARDING.md"),
    read("package.json"),
  ]);
  const scripts = JSON.parse(packageText).scripts;
  const commands = [...`${readme}\n${onboarding}`.matchAll(/npm run ([\w:-]+)/g)].map(
    ([, command]) => command,
  );

  assert.ok(commands.length > 0);
  for (const command of commands)
    assert.ok(scripts[command], `missing npm script: ${command}`);
});

test("current local documentation links resolve", async () => {
  const files = [
    "README.md",
    "docs/DEVELOPER_ONBOARDING.md",
    "docs/ARCHITECTURE.md",
    "docs/LIGHTSPEED_RUNBOOK.md",
    "docs/ANALYTICS.md",
  ];

  for (const file of files) {
    const text = await read(file);
    for (const [, href] of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|#)/.test(href)) continue;
      await readFile(new URL(href, new URL(file, root)), "utf8");
    }
  }
});

test("current docs do not direct operators to retired application surfaces", async () => {
  const currentDocs = await Promise.all([
    read("README.md"),
    read("docs/DEVELOPER_ONBOARDING.md"),
    read("docs/ARCHITECTURE.md"),
    read("docs/LIGHTSPEED_RUNBOOK.md"),
    read("docs/ANALYTICS.md"),
  ]);
  const text = currentDocs.join("\n");

  assert.doesNotMatch(text, /\/api\/checkout|\/admin\/analytics\/traffic|two-way sync/i);
});
