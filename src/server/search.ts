import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ShowView } from "@/modules/live";
import type { SearchAll } from "@/lib/types";
import { searchWords } from "@/shared/infrastructure/ts-query";
import { CATALOG_TAG, CONTENT_TAG, LIVE_TAG } from "./cache-tags";
import { getSellers, searchCatalog } from "./catalog";
import { services } from "./container";
import { getLiveLobby } from "./live";

// Everything a search finds besides products: videos, shops and live rooms. Products come
// first because they also decide which videos and rooms match (a video or a show selling
// a matching product is a match, whatever its caption says).

const EMPTY: SearchAll = { videos: [], shops: [], live: [], people: [] };

/** Cached for a few minutes per query, like product search. */
export async function searchAll(text: string): Promise<SearchAll> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG, CONTENT_TAG, LIVE_TAG);
  const q = text.trim();
  if (!searchWords(q).length) return EMPTY;

  const app = await services();
  const [products, shops, lobby, sellers, people] = await Promise.all([
    searchCatalog({ text: q, sort: "best", limit: 60 }),
    app.searchShops(q, 20),
    getLiveLobby(),
    getSellers(),
    app.profiles.search(q, 20),
  ]);
  const matched = new Set(products.map((p) => p.slug));
  const sellerName = new Map(sellers.map((s) => [s.id, s.name]));

  const videos = await app.content.searchVideos(q, [...matched], 30);
  const titles = new Map(products.map((p) => [p.slug, p.title]));
  const missing = [...new Set(videos.map((v) => v.productSlug).filter((slug) => !titles.has(slug)))];
  if (missing.length) for (const p of await app.catalog.getProductsBySlugs(missing)) titles.set(p.slug, p.title);

  const words = searchWords(q);
  const says = (show: ShowView) => {
    const tokens = searchWords([show.title, show.hostName, show.place, sellerName.get(show.sellerId) ?? ""].join(" "));
    return words.every((w) => tokens.some((t) => t.startsWith(w)));
  };
  const live = [...lobby.live, ...lobby.upcoming]
    .filter((s) => says(s) || s.items.some((i) => matched.has(i.slug)))
    .map((s) => ({
      id: s.id,
      title: s.title,
      hostName: s.hostName,
      kind: s.kind,
      coverUrl: s.coverUrl,
      place: s.place,
      peakViewers: s.peakViewers,
      scheduledFor: s.scheduledFor,
      status: s.status === "live" ? ("live" as const) : ("scheduled" as const),
      sellerName: sellerName.get(s.sellerId) ?? "",
    }));

  return {
    videos: videos.map((v) => ({
      id: v.id,
      image: v.image,
      tone: v.tone,
      likes: v.likes,
      views: v.views,
      title: titles.get(v.productSlug) ?? v.caption,
      sellerName: sellerName.get(v.sellerId) ?? "",
    })),
    shops,
    people: people.map((p) => ({ handle: p.handle, name: p.name, avatar: p.avatar, bio: p.bio })),
    live,
  };
}
