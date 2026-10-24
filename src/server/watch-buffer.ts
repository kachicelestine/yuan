import "server-only";
import type { WatchTally } from "@/modules/content";
import { log } from "@/shared/infrastructure/log";
import { services } from "./container";

// Watch beacons arrive constantly; writing each one would cost a transaction per swipe.
// They're summed in memory per video and written every few seconds in one batch. A crash
// loses at most one window of view counts, which is acceptable for counters.

const FLUSH_MS = 5_000;
const MAX_VIDEOS = 2_000;

type Tally = { views: number; watchMs: number; completes: number };
const state = globalThis as unknown as { __watchBuffer?: { pending: Map<string, Tally>; timer: NodeJS.Timeout | null } };
const buffer = (state.__watchBuffer ??= { pending: new Map(), timer: null });

export function addWatch(videoId: string, watch: { view: boolean; ms: number; complete: boolean }) {
  const t = buffer.pending.get(videoId) ?? { views: 0, watchMs: 0, completes: 0 };
  t.views += watch.view ? 1 : 0;
  t.watchMs += watch.ms;
  t.completes += watch.complete ? 1 : 0;
  buffer.pending.set(videoId, t);
  if (buffer.pending.size >= MAX_VIDEOS) void flushWatches();
  else buffer.timer ??= setTimeout(() => void flushWatches(), FLUSH_MS).unref();
}

export async function flushWatches() {
  if (buffer.timer) clearTimeout(buffer.timer);
  buffer.timer = null;
  if (!buffer.pending.size) return;
  const tallies: WatchTally[] = [...buffer.pending].map(([videoId, t]) => ({ videoId, ...t }));
  buffer.pending = new Map();
  try {
    await (await services()).interactions.recordWatches(tallies);
  } catch (error) {
    log.error("watch flush failed", { scope: "content", videos: tallies.length, error: String(error) });
  }
}
