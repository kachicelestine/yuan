import "server-only";
import { createHmac } from "node:crypto";
import { serverEnv } from "@/config/server-env";
import { matchesKeywords } from "@/modules/ads";
import type { ProductView, SearchCriteria } from "@/modules/catalog";
import type { FeedItem } from "@/lib/types";
import { searchCatalog } from "./catalog";
import { services } from "./container";
import { getFeedItems } from "./feed";
import { clientIp } from "./rate-limits";
import { currentAccount } from "./session";

// Sponsored slots. Which listings may fill a slot is a catalog question (does the
// advertised product match this search or category?), cached like any search; who wins
// and what a click costs is decided per request by the ads auction, never cached.

export type Sponsored = { product: ProductView; token: string };

/**
 * Who is looking, so an ad counts once a day per person: their account, or for people
 * signed out a keyed hash of their address (the address itself is never stored).
 */
export async function adViewer(): Promise<string | null> {
  const account = await currentAccount();
  if (account) return account.id;
  const ip = await clientIp();
  return ip ? `ip:${createHmac("sha256", serverEnv.AUTH_SECRET ?? "development").update(ip).digest("base64url").slice(0, 32)}` : null;
}

export async function sponsored(criteria: Omit<SearchCriteria, "slugs" | "sort" | "limit">, slots: number, viewer: string | null = null): Promise<Sponsored[]> {
  const app = await services();
  const promoted = await app.ads.promoted();
  if (!promoted.length) return [];
  // Sorted, so the same advertised set makes the same cache key.
  const slugs = [...new Set(promoted.map((p) => p.slug))].sort();
  const matched = await searchCatalog({ ...criteria, slugs, sort: "best", limit: 50 });
  // Listings whose campaign has a keyword the search uses, if they pass the other filters too.
  const keyworded = (p: (typeof promoted)[number]) => !!criteria.text && matchesKeywords(criteria.text, p.keywords ?? []);
  const extraSlugs = [...new Set(promoted.filter((p) => keyworded(p) && !matched.some((m) => m.slug === p.slug)).map((p) => p.slug))].sort();
  const extra = extraSlugs.length ? await searchCatalog({ ...criteria, text: "", slugs: extraSlugs, sort: "best", limit: 50 }) : [];
  const found = [...matched, ...extra];
  if (!found.length) return [];
  const rank = new Map(found.map((p, i) => [p.slug, i]));
  const byKeywordOnly = new Set(extra.map((p) => p.slug));
  // A listing found only by keyword competes only for the campaigns that chose that keyword.
  const eligible = promoted.filter((p) => rank.has(p.slug) && (!byKeywordOnly.has(p.slug) || keyworded(p))).sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!);
  const bySlug = new Map(found.map((p) => [p.slug, p]));
  return (await app.ads.serve(eligible, slots, viewer)).map((s) => ({ product: bySlug.get(s.slug)!, token: s.token }));
}

/**
 * A boosted video for the feed's next sponsored slide, if one wins the auction: the slide
 * (assembled like any other, so a removed video or product drops out) and the click token.
 */
export async function sponsoredVideo(skip: readonly string[] = [], viewer: string | null = null): Promise<(FeedItem & { sponsored: { token: string } }) | null> {
  const app = await services();
  const eligible = (await app.ads.promotedVideos()).filter((e) => e.videoId && !skip.includes(e.videoId));
  if (!eligible.length) return null;
  const [won] = await app.ads.serve(eligible, 1, viewer);
  if (!won?.videoId) return null;
  const [item] = await getFeedItems([won.videoId]);
  return item ? { ...item, sponsored: { token: won.token } } : null;
}
