import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ProductView } from "@/modules/catalog";
import { compact } from "@/lib/format";
import { PERIOD_DAYS, type BoardId, type Move, type Period, type RankedProduct, type RankedSeller, type Rankings } from "@/lib/rankings";
import { CATALOG_TAG, RANKINGS_TAG } from "./cache-tags";
import { services } from "./container";

// Leaderboards from what actually happened: units in paid orders and saves in the window,
// compared with the window before for movement. A quiet window is topped up with all-time
// leaders, and says so, rather than inventing numbers.

const DAY = 86_400_000;
const SIZE = 20;
const MIN_ROWS = 10;
const PERIOD_WORD: Record<Period, string> = { day: "today", week: "this week", month: "this month" };

/** Keys by score, highest first; ties go to the all-time favourite. */
function order(scores: Map<string, number>, tiebreak: (key: string) => number) {
  return [...scores.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || tiebreak(b[0]) - tiebreak(a[0])).map(([k]) => k);
}

function moves(now: readonly string[], before: readonly string[]): Map<string, Move> {
  const prev = new Map(before.map((k, i) => [k, i]));
  return new Map(now.map((k, i) => [k, prev.has(k) ? prev.get(k)! - i : null]));
}

export async function getRankings(board: BoardId, period: Period, category?: string): Promise<Rankings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG, RANKINGS_TAG);
  const app = await services();
  const now = new Date();
  const span = PERIOD_DAYS[period] * DAY;
  const from = new Date(now.getTime() - span);
  const before = new Date(now.getTime() - 2 * span);

  const all = (await app.catalog.listProducts({ category, limit: 1000 })).filter((p) => !category || p.category === category);
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  const sold = (p: ProductView) => p.sold ?? 0;
  const updatedAt = now.toISOString();

  if (board === "rated") {
    const rows: RankedProduct[] = all
      .filter((p) => p.reviews >= 50)
      .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
      .slice(0, SIZE)
      .map((p) => ({ kind: "product", product: p, metric: `★ ${p.rating}`, detail: `${compact(p.reviews)} reviews`, move: 0 }));
    return { rows, note: null, updatedAt };
  }

  if (board === "factories") return { ...(await risingFactories(all, from, before, now, period)), updatedAt };

  // Best sellers count units in paid orders; most saved counts people saving it.
  const window = async (a: Date, b: Date) => {
    if (board === "hot") {
      const m = new Map<string, number>();
      for (const s of await app.getOrder.sales(a, b)) if (bySlug.has(s.slug)) m.set(s.slug, (m.get(s.slug) ?? 0) + s.units);
      return m;
    }
    return new Map([...(await app.engagement.savesBetween(a, b))].filter(([slug]) => bySlug.has(slug)));
  };
  const [current, previous] = await Promise.all([window(from, now), window(before, from)]);
  const ranked = order(current, (k) => sold(bySlug.get(k)!)).slice(0, SIZE);
  const moved = moves(ranked, order(previous, (k) => sold(bySlug.get(k)!)));
  const unit = board === "hot" ? "sold" : "saves";

  const rows: RankedProduct[] = ranked.map((slug) => {
    const p = bySlug.get(slug)!;
    return { kind: "product", product: p, metric: `${compact(current.get(slug)!)} ${unit}`, detail: board === "hot" ? `${compact(sold(p))} all time` : `★ ${p.rating} · ${compact(p.reviews)} reviews`, move: moved.get(slug) ?? null };
  });

  let note: string | null = null;
  if (rows.length < MIN_ROWS) {
    // Quiet window: fill with all-time leaders, labelled as such.
    const allTime = board === "hot" ? new Map(all.map((p) => [p.slug, sold(p)])) : await window(new Date(0), now);
    for (const slug of order(allTime, (k) => sold(bySlug.get(k)!))) {
      if (rows.length >= SIZE) break;
      if (current.has(slug)) continue;
      const p = bySlug.get(slug)!;
      rows.push({ kind: "product", product: p, metric: `${compact(allTime.get(slug)!)} all time`, detail: board === "hot" ? "sold" : "saves", move: 0 });
    }
    if (rows.length > ranked.length) note = ranked.length ? `Only ${ranked.length} ${ranked.length === 1 ? "product has" : "products have"} ${board === "hot" ? "sold" : "been saved"} ${PERIOD_WORD[period]} so far; the rest are all-time favourites.` : `Nothing has ${board === "hot" ? "sold" : "been saved"} ${PERIOD_WORD[period]} yet; these are the all-time favourites.`;
  }
  return { rows, note, updatedAt };
}

/** Shops whose sales grew most against the window before (new sellers count as new). */
async function risingFactories(all: ProductView[], from: Date, before: Date, now: Date, period: Period): Promise<Omit<Rankings, "updatedAt">> {
  const app = await services();
  const units = async (a: Date, b: Date) => {
    const m = new Map<string, number>();
    const inScope = new Set(all.map((p) => p.slug));
    for (const s of await app.getOrder.sales(a, b)) if (inScope.has(s.slug)) m.set(s.sellerId, (m.get(s.sellerId) ?? 0) + s.units);
    return m;
  };
  const [current, previous] = await Promise.all([units(from, now), units(before, from)]);
  const growth = new Map([...current].map(([id, n]) => [id, previous.get(id) ? (n - previous.get(id)!) / previous.get(id)! : Infinity]));
  const ranked = [...growth.entries()].filter(([, g]) => g > 0).sort((a, b) => b[1] - a[1] || current.get(b[0])! - current.get(a[0])!).map(([id]) => id).slice(0, 12);
  const prevRanked = [...previous.keys()].sort((a, b) => previous.get(b)! - previous.get(a)!);
  const moved = moves(ranked, prevRanked);

  const pages = new Map((await Promise.all([...new Set([...ranked, ...all.map((p) => p.sellerId)])].map((id) => app.catalog.getSeller(id)))).flatMap((p) => (p ? [[p.seller.id, p] as const] : [])));
  const picks = (id: string) => all.filter((p) => p.sellerId === id).sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0)).slice(0, 3);
  const row = (id: string, metric: string, detail: string, move: Move): RankedSeller | null => {
    const page = pages.get(id);
    return page ? { kind: "seller", seller: page.seller, cover: page.storefront?.cover ?? page.seller.avatar, metric, detail, move, picks: picks(id) } : null;
  };

  const rows = ranked.flatMap((id) => {
    const g = growth.get(id)!;
    const r = row(id, g === Infinity ? "New" : `+${Math.round(g * 100)}%`, `${compact(current.get(id)!)} sold ${PERIOD_WORD[period]}`, moved.get(id) ?? null);
    return r ? [r] : [];
  });
  let note: string | null = null;
  if (rows.length < 3) {
    // Quiet window: the best-rated shops instead, labelled as such.
    const rated = [...pages.values()].filter((p) => !ranked.includes(p.seller.id) && p.storefront && picks(p.seller.id).length).sort((a, b) => (b.storefront?.rating ?? 0) - (a.storefront?.rating ?? 0));
    for (const p of rated.slice(0, 12 - rows.length)) {
      const r = row(p.seller.id, `★ ${p.storefront!.rating}`, `${compact(p.storefront!.followers)} followers · top rated`, 0);
      if (r) rows.push(r);
    }
    note = ranked.length ? `Few shops have grown ${PERIOD_WORD[period]} so far; the rest are the best rated.` : `No shop's sales have grown ${PERIOD_WORD[period]} yet; these are the best rated.`;
  }
  return { rows, note };
}
