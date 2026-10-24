"use client";

import type { CategoryId, Market } from "@/lib/catalog";
import { useStored } from "@/lib/use-stored";
import type { FeedItem } from "./feed-slide";

export type FeedPrefs = { more: CategoryId[]; less: CategoryId[]; muted: string[] };

const none: FeedPrefs = { more: [], less: [], muted: [] };

/** Interests and muted sellers, kept on the device; the feed reorders what you haven't seen yet. */
export function useFeedPrefs() {
  const [prefs, setPrefs] = useStored<FeedPrefs>("app.feed-prefs", none);

  /** Cycles a category through neutral, more and less. */
  function cycle(id: CategoryId) {
    setPrefs((p) => {
      if (p.more.includes(id)) return { ...p, more: p.more.filter((c) => c !== id), less: [...p.less, id] };
      if (p.less.includes(id)) return { ...p, less: p.less.filter((c) => c !== id) };
      return { ...p, more: [...p.more, id] };
    });
  }

  function lean(id: CategoryId, way: "more" | "less" | null) {
    setPrefs((p) => {
      const more = p.more.filter((c) => c !== id);
      const less = p.less.filter((c) => c !== id);
      return { ...p, more: way === "more" ? [...more, id] : more, less: way === "less" ? [...less, id] : less };
    });
  }

  function mute(sellerId: string) {
    setPrefs((p) => ({ ...p, muted: p.muted.includes(sellerId) ? p.muted.filter((s) => s !== sellerId) : [...p.muted, sellerId] }));
  }

  return { prefs, cycle, lean, mute, reset: () => setPrefs(none) };
}

/** Lower sorts first: asked-for topics, then the rest, then topics you turned down. */
export function weight(item: FeedItem, prefs: FeedPrefs) {
  return prefs.more.includes(item.product.category) ? 0 : prefs.less.includes(item.product.category) ? 2 : 1;
}

/** Plain-language reasons this video is in the feed, most specific first. */
export function whySeeing(item: FeedItem, prefs: FeedPrefs, followed: boolean, market: Market) {
  const reasons: string[] = [];
  if (followed) reasons.push(`You follow ${item.seller.name}`);
  if (prefs.more.includes(item.product.category)) reasons.push(`You asked for more ${item.related.category.toLowerCase()}`);
  if (item.video.likes > 100_000) reasons.push(`Trending in ${market.name} this week`);
  reasons.push(`Popular with people who saved ${item.related.category.toLowerCase()}`);
  if (item.seller.verified) reasons.push(`${item.seller.name} is a verified ${item.seller.kind.toLowerCase()}`);
  return reasons.slice(0, 3);
}
