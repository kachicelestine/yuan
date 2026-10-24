import type { VideoStats } from "./repositories";

// Feed ranking, version 0: one global order everyone shares (so it can be cached), which
// the device then tunes with the viewer's own "more / less of this" choices.
//
// A video's score is how much people engage per view, smoothed toward a typical rate so
// a video with 3 views and 2 likes doesn't outrank one with 30k views, times a freshness
// curve so the feed keeps moving. New uploads that haven't been seen much get regular
// slots of their own (exploration), or nothing new could ever earn its way up.

export type Candidate = Readonly<{ id: string; publishedAt: Date; stats: VideoStats }>;

/** Typical engagements per view across the catalog, and how many views it's worth. */
const PRIOR_RATE = 0.08;
const PRIOR_VIEWS = 200;
/** Freshness halves over roughly two days. */
const HALF_LIFE_HOURS = 48;
/** Below this many views a video still counts as unproven. */
export const EXPLORE_UNDER_VIEWS = 500;

/** Shares and comments say more than a like; a save means they'll come back. */
export function engagements(s: VideoStats) {
  return s.likes + 2 * s.comments + 3 * s.shares + 2 * s.saves;
}

export function score(c: Candidate, now: Date) {
  const quality = (engagements(c.stats) + PRIOR_RATE * PRIOR_VIEWS) / (c.stats.views + PRIOR_VIEWS);
  const ageHours = Math.max(0, (now.getTime() - c.publishedAt.getTime()) / 3_600_000);
  const freshness = 1 / (1 + ageHours / HALF_LIFE_HOURS);
  return quality * freshness;
}

/**
 * Candidates in feed order: best score first, with every `exploreEvery`-th slot given to
 * the newest unproven video. Deterministic, so a cached page and the next one agree.
 */
export function rankFeed(candidates: readonly Candidate[], now: Date, exploreEvery = 4): string[] {
  const byScore = [...candidates].sort((a, b) => score(b, now) - score(a, now) || a.id.localeCompare(b.id));
  const fresh = candidates
    .filter((c) => c.stats.views < EXPLORE_UNDER_VIEWS)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.id.localeCompare(b.id));
  const placed = new Set<string>();
  const order: string[] = [];
  let main = 0;
  let explore = 0;
  while (order.length < candidates.length) {
    const exploring = exploreEvery > 0 && (order.length + 1) % exploreEvery === 0;
    let next: Candidate | undefined;
    if (exploring) {
      while (explore < fresh.length && placed.has(fresh[explore].id)) explore++;
      next = fresh[explore];
    }
    if (!next) {
      while (main < byScore.length && placed.has(byScore[main].id)) main++;
      next = byScore[main];
    }
    if (!next) break;
    placed.add(next.id);
    order.push(next.id);
  }
  return order;
}
