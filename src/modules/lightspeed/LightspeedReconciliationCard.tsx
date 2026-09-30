"use client";

import { LightspeedReviewQueue } from "./LightspeedReviewQueue";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReconciliationSummary, FailureGroup } from "./reconciliation";

export interface Run {
  status: string;
  summary: Partial<ReconciliationSummary> | null;
  created_at: string;
  completed_at: string | null;
}

interface WebhookEvent {
  id: string;
  event_id: string;
  topic: string;
  state: string;
  attempts: number;
  last_error: string | null;
}

export function LightspeedReconciliationCard() {
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [latestEvent, setLatestEvent] = useState<WebhookEvent | null>(null);
  const [now, setNow] = useState(0);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      let shouldPoll = true;
      try {
        const response = await fetch("/api/admin/lightspeed/reconcile", {
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error("status_unavailable");
        const payload = await response.json();
        if (disposed) return;
        setRun(payload.run ?? null);
        setStatusError("");
        shouldPoll = running || payload.run?.status === "running";
      } catch {
        if (!disposed) setStatusError("Could not refresh sync status. Retrying…");
      } finally {
        if (!disposed && shouldPoll) timer = setTimeout(() => void refresh(), 3_000);
      }
    }
    void refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [running]);

  useEffect(() => {
    if (run?.status !== "running") return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [run?.status]);

  useEffect(() => {
    void fetch("/api/admin/lightspeed/events")
      .then((response) => response.json())
      .then((payload) => setLatestEvent(payload.events?.[0] ?? null))
      .catch(() => undefined);
  }, []);

  async function startSync() {
    setRunning(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/lightspeed/reconcile", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Sync failed");
      }
      setMessage(
        payload.summary.failed > 0
          ? "Sync completed with item errors."
          : "Sync completed.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not confirm the sync result. Check the run status below.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function retryEvent() {
    if (!latestEvent) return;
    setRunning(true);
    setMessage("Retrying webhook event…");
    try {
      const response = await fetch(
        `/api/admin/lightspeed/events/${encodeURIComponent(latestEvent.id)}/retry`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Webhook retry failed");
        return;
      }
      setLatestEvent(payload.event);
      setMessage(`Webhook retry ${payload.event.state.replaceAll("_", " ")}.`);
    } catch {
      setMessage(
        "Could not confirm the webhook retry result. Check the run status below.",
      );
    } finally {
      setRunning(false);
    }
  }

  const counts = run?.summary;

  return (
    <section
      className="rounded border border-zinc-800/70 bg-zinc-900 p-6"
      aria-labelledby="lightspeed-sync-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="lightspeed-sync-title" className="text-xl font-semibold text-white">
            Lightspeed catalog
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Pull authoritative products, variants, availability, and stock into the
            storefront.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void startSync()}
          disabled={running || run?.status === "running"}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-white px-4 py-2 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Syncing…" : "Sync from Lightspeed"}
        </button>
      </div>

      {counts ? (
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["created", "updated", "retired", "skipped", "failed"] as const).map(
            (key) => (
              <div key={key} className="rounded border border-zinc-800 bg-black/20 p-3">
                <dt className="text-xs capitalize text-gray-400">{key}</dt>
                <dd className="mt-1 text-xl font-semibold text-white">
                  {counts[key] ?? 0}
                </dd>
              </div>
            ),
          )}
        </dl>
      ) : null}

      <p className="mt-4 min-h-5 text-sm text-gray-300" role="status" aria-live="polite">
        {run?.summary?.error ||
          message ||
          (run ? `Last run: ${run.status.replaceAll("_", " ")}` : "No sync has run yet.")}
      </p>
      {run ? <SyncProgress run={run} now={now} /> : null}
      <LightspeedReviewQueue disabled={running || run?.status === "running"} />
      {run?.summary?.failure_groups?.length ? (
        <SyncErrors groups={run.summary.failure_groups} />
      ) : null}
      {statusError ? (
        <p role="alert" className="mt-2 text-sm text-gray-300">
          {statusError}
        </p>
      ) : null}
      {latestEvent ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3 text-sm text-gray-400">
          <span>
            Latest webhook: {latestEvent.topic} · {latestEvent.state.replaceAll("_", " ")}{" "}
            · attempt {latestEvent.attempts}
          </span>
          {latestEvent.state === "retry_wait" ||
          latestEvent.state === "needs_attention" ? (
            <button
              type="button"
              onClick={() => void retryEvent()}
              disabled={running || run?.status === "running"}
              className="rounded border border-zinc-700 px-3 py-1 text-white hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Retry event
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function SyncErrors({ groups }: { groups: FailureGroup[] }) {
  return (
    <div className="mt-4 space-y-3 border-t border-zinc-700 pt-4">
      <h3 className="font-semibold text-white">Error details</h3>
      {[...groups]
        .sort((a, b) => b.count - a.count)
        .map((group) => (
          <details key={group.reason} className="rounded border border-zinc-700 p-3">
            <summary className="cursor-pointer text-sm text-white">
              {group.count.toLocaleString()} failed families ·{" "}
              {group.reason.startsWith("[")
                ? "Validation error (older saved details)"
                : group.reason.split("\n")[0]}
            </summary>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-gray-300">
              {group.reason}
            </pre>
            {group.reason.startsWith("[") ? (
              <p className="mt-2 text-xs text-gray-400">
                Older error records may be truncated. Future runs preserve readable
                validation details.
              </p>
            ) : null}
            <p className="mt-3 break-all text-xs text-gray-300">
              Example family IDs: {group.family_ids.join(", ")}
            </p>
          </details>
        ))}
    </div>
  );
}

export function SyncProgress({ run, now }: { run: Run; now: number }) {
  const progress = run.summary?.progress;
  const isRunning = run.status === "running";
  const end = run.completed_at ?? progress?.updated_at ?? run.created_at;
  const elapsed = Math.max(
    0,
    Math.floor(((isRunning ? now : Date.parse(end)) - Date.parse(run.created_at)) / 1000),
  );
  const age =
    isRunning && progress
      ? Math.max(0, Math.floor((now - Date.parse(progress.updated_at)) / 1000))
      : null;
  const labels = {
    listing: "Discovering product records",
    downloading: "Downloading families and inventory",
    applying: "Updating catalog families",
    retiring: "Checking removed families",
    completed: "Finished",
    failed: "Stopped",
  };
  return (
    <div className="mt-3 space-y-2 text-sm text-gray-300">
      {progress ? (
        <>
          <p>
            {labels[progress.phase]}: {progress.completed.toLocaleString()}
            {progress.total === null ? "" : ` / ${progress.total.toLocaleString()}`}
          </p>
          {run.status === "running" && progress.total !== null && progress.total > 0 ? (
            <progress
              className="w-full accent-white"
              aria-label={labels[progress.phase]}
              value={progress.completed}
              max={progress.total}
            />
          ) : null}
        </>
      ) : run.status === "running" ? (
        <p>
          This run has no progress details. Runs started before this update cannot report
          progress.
        </p>
      ) : null}
      <p>
        Elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s
        {age === null ? "" : ` · Last activity: ${age}s ago`}
      </p>
      {!isRunning && run.completed_at && (
        <p>
          {run.status === "failed" ? "Stopped" : "Completed"}:{" "}
          <time dateTime={run.completed_at}>
            {new Date(run.completed_at).toLocaleString()}
          </time>
        </p>
      )}
      {run.status === "running" && age !== null && age >= 60 ? (
        <p role="status">
          No progress reported for at least 60 seconds. This run may be stalled;
          completion is not confirmed.
        </p>
      ) : null}
    </div>
  );
}
