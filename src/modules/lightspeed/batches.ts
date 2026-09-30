import type { ReconciliationSummary } from "./reconciliation";

export interface SyncCheckpoint {
  phase: "listing" | "applying" | "retiring" | "done";
  cursor: number;
  listed: number;
  ids: string[];
  excluded: string[];
  index: number;
  retireAfter: string | null;
}

export const newCheckpoint = (): SyncCheckpoint => ({
  phase: "listing",
  cursor: 0,
  listed: 0,
  ids: [],
  excluded: [],
  index: 0,
  retireAfter: null,
});
export const newSummary = (): ReconciliationSummary => ({
  created: 0,
  updated: 0,
  retired: 0,
  skipped: 0,
  failed: 0,
});

// Each step is checkpointed before the worker starts another provider page or family.
export async function advanceSync(
  state: SyncCheckpoint,
  summary: ReconciliationSummary,
  io: {
    list(cursor: number): Promise<{ ids: string[]; cursor: number; count: number }>;
    apply(id: string): Promise<boolean>;
    nextLinked(after: string | null): Promise<string | null>;
    retire(id: string): Promise<number>;
  },
) {
  if (state.phase === "listing") {
    const page = await io.list(state.cursor);
    if (page.count && page.cursor <= state.cursor)
      throw new Error("lightspeed_cursor_did_not_advance");
    state.ids = [...new Set([...state.ids, ...page.ids])];
    state.cursor = page.cursor;
    state.listed += page.count;
    if (!page.count) state.phase = "applying";
  } else if (state.phase === "applying") {
    const id = state.ids[state.index];
    if (id !== undefined) {
      if (!(await io.apply(id))) state.excluded.push(id);
      state.index++;
    }
    if (state.index === state.ids.length) state.phase = "retiring";
  } else if (state.phase === "retiring") {
    const id = await io.nextLinked(state.retireAfter);
    if (id === null) state.phase = "done";
    else {
      if (!state.ids.includes(id) || state.excluded.includes(id))
        summary.retired += await io.retire(id);
      state.retireAfter = id;
    }
  }
  summary.progress = {
    phase: state.phase === "done" ? "completed" : state.phase,
    completed: state.phase === "listing" ? state.listed : state.index,
    total:
      state.phase === "listing" || state.phase === "retiring" ? null : state.ids.length,
    updated_at: new Date().toISOString(),
  };
}
