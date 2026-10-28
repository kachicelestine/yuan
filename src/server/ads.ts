import "server-only";
import type { ProductView, SearchCriteria } from "@/modules/catalog";
import type { FeedItem } from "@/lib/types";
import { searchCatalog } from "./catalog";
import { services } from "./container";
import { getFeedItems } from "./feed";

// Sponsored slots. Which listings may fill a slot is a catalog question (does the
// advertised product match this search or category?), cached like any search; who wins
// and what a click costs is decided per request by the ads auction, never cached.

export type Sponsored = { product: ProductView; token: string };

export async function sponsored(criteria: Omit<SearchCriteria, "slugs" | "sort" | "limit">, slots: number): Promise<Sponsored[]> {
  const app = await services();
  const promoted = await app.ads.promoted();
  if (!promoted.length) return [];
  // Sorted, so the same advertised set makes the same cache key.
  const slugs = [...new Set(promoted.map((p) => p.slug))].sort();
  const matched = await searchCatalog({ ...criteria, slugs, sort: "best", limit: 50 });
  if (!matched.length) return [];
  const rank = new Map(matched.map((p, i) => [p.slug, i]));
  const eligible = promoted.filter((p) => rank.has(p.slug)).sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!);
  const bySlug = new Map(matched.map((p) => [p.slug, p]));
  return (await app.ads.serve(eligible, slots)).map((s) => ({ product: bySlug.get(s.slug)!, token: s.token }));
}

/**
 * A boosted video for the feed's next sponsored slide, if one wins the auction: the slide
 * (assembled like any other, so a removed video or product drops out) and the click token.
 */
export async function sponsoredVideo(skip: readonly string[] = []): Promise<(FeedItem & { sponsored: { token: string } }) | null> {
  const app = await services();
  const eligible = (await app.ads.promotedVideos()).filter((e) => e.videoId && !skip.includes(e.videoId));
  if (!eligible.length) return null;
  const [won] = await app.ads.serve(eligible, 1);
  if (!won?.videoId) return null;
  const [item] = await getFeedItems([won.videoId]);
  return item ? { ...item, sponsored: { token: won.token } } : null;
}
