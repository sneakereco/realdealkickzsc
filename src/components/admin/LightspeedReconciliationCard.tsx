"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface Summary {
  created: number;
  updated: number;
  retired: number;
  skipped: number;
  failed: number;
}

interface Run {
  status: string;
  summary: Partial<Summary> | null;
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

  useEffect(() => {
    void fetch("/api/admin/lightspeed/reconcile")
      .then((response) => response.json())
      .then((payload) => setRun(payload.run ?? null))
      .catch(() => setMessage("Could not load the latest sync status."));
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
      setRun({
        status: payload.summary.failed > 0 ? "partial_failure" : "success",
        summary: payload.summary,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
      setMessage(
        payload.summary.failed > 0
          ? "Sync completed with item errors."
          : "Sync completed.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setRunning(false);
    }
  }

  async function retryEvent() {
    if (!latestEvent) return;
    setMessage("Retrying webhook event…");
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
        {message ||
          (run ? `Last run: ${run.status.replaceAll("_", " ")}` : "No sync has run yet.")}
      </p>
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
              className="rounded border border-zinc-700 px-3 py-1 text-white hover:border-zinc-500"
            >
              Retry event
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
