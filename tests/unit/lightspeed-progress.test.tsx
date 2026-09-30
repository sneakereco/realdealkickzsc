import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  SyncProgress,
  SyncErrors,
  type Run,
} from "@/modules/lightspeed/LightspeedReconciliationCard";

const now = Date.parse("2026-09-29T17:10:00Z");
const run: Run = {
  status: "running",
  created_at: "2026-09-29T17:00:00Z",
  completed_at: null,
  summary: {
    progress: {
      phase: "downloading",
      completed: 450,
      total: 1000,
      updated_at: "2026-09-29T17:09:57Z",
    },
  },
};

test("shows download counts, elapsed time, and last activity", () => {
  const html = renderToStaticMarkup(<SyncProgress run={run} now={now} />);
  expect(html).toContain("Downloading families and inventory: 450 / 1,000");
  expect(html).toContain('value="450" max="1000"');
  expect(html).toContain("Elapsed: 10m 0s · Last activity: 3s ago");
  expect(html).not.toContain("may be stalled");
});

test("warns about stale progress without claiming the run failed", () => {
  const html = renderToStaticMarkup(<SyncProgress run={run} now={now + 60_000} />);
  expect(html).toContain("may be stalled; completion is not confirmed");
});

test("explains missing progress for an older running job", () => {
  const html = renderToStaticMarkup(
    <SyncProgress run={{ ...run, summary: {} }} now={now} />,
  );
  expect(html).toContain("This run has no progress details");
  expect(html).not.toContain("<progress");
});

test("freezes elapsed time at completion and removes the stale warning", () => {
  const html = renderToStaticMarkup(
    <SyncProgress
      run={{ ...run, status: "success", completed_at: "2026-09-29T17:05:00Z" }}
      now={now}
    />,
  );
  expect(html).toContain("Elapsed: 5m 0s");
  expect(html).not.toContain("may be stalled");
  expect(html).not.toContain("<progress");
});

test("shows grouped error counts, readable causes, and example IDs", () => {
  const html = renderToStaticMarkup(
    <SyncErrors
      groups={[
        {
          reason: "includes.tags: Expected array\ndata.brand_id: Expected string",
          count: 2660,
          family_ids: ["family-1", "family-2"],
        },
      ]}
    />,
  );
  expect(html).toContain("Error details");
  expect(html).toContain("2,660 failed families");
  expect(html).toContain("data.brand_id: Expected string");
  expect(html).toContain("Example family IDs: family-1, family-2");
});
