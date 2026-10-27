import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ProductView } from "@/modules/catalog";
import type { VideoView } from "@/modules/content";
import type { FeedItem, FeedPage } from "@/lib/types";
import { CATALOG_TAG, CONTENT_TAG, FEED_TAG } from "./cache-tags";
import { getCategories, getProducts, getSellers } from "./catalog";
import { getFeedOrder, getFollowingVideos, getVideosByIds } from "./content";
import { services } from "./container";

// The feed joins two contexts: content says which videos and in what order, the catalog
// says what they sell. Pages are cut from one cached ranked order, so page 2 continues
// page 1 even as new videos arrive (they show up once the order is refreshed).

/** First paint carries a few slides; the rest stream in as the viewer swipes. */
export const FIRST_PAGE = 4;
export const PAGE = 8;

/** Feed slides for these videos, in order. Videos whose product or shop is gone drop out. */
async function assemble(videos: VideoView[]): Promise<FeedItem[]> {
  if (!videos.length) return [];
  const slugs = [...new Set(videos.flatMap((v) => [v.productSlug, ...(v.also ?? [])]))];
  const [tagged, sellers, categories] = await Promise.all([productsBySlug(slugs), getSellers(), getCategories()]);
  const sellerById = new Map(sellers.map((s) => [s.id, s]));
  const productBySlug = new Map(tagged.map((p) => [p.slug, p]));

  // Rails for the sheet's More tab, one cached read per shop and per category on the page.
  const shopIds = [...new Set(videos.map((v) => v.sellerId))];
  const categoryIds = [...new Set(tagged.map((p) => p.category))];
  const [shopLists, categoryLists] = await Promise.all([
    Promise.all(shopIds.map((id) => getProducts({ seller: id, limit: 8 }))),
    Promise.all(categoryIds.map((id) => getProducts({ category: id, limit: 24 }))),
  ]);
  const byShop = new Map(shopIds.map((id, i) => [id, shopLists[i]]));
  const byCategory = new Map(categoryIds.map((id, i) => [id, categoryLists[i]]));
  // Videos people posted (not shops) carry the poster's creator code.
  const app = await services();
  const authors = await app.content.authorsOf(videos.map((v) => v.id));
  const people = [...new Set(authors.values())];
  const [codes, creators] = await Promise.all([app.affiliates.codesFor(people), app.profiles.actors(people)]);

  return videos.flatMap((video) => {
    const product = productBySlug.get(video.productSlug);
    const seller = sellerById.get(video.sellerId);
    if (!product || !seller) return [];
    const related = {
      fromSeller: (byShop.get(seller.id) ?? []).filter((p) => p.slug !== product.slug).slice(0, 6),
      similar: (byCategory.get(product.category) ?? []).filter((p) => p.sellerId !== product.sellerId).slice(0, 4),
      category: categories.find((c) => c.id === product.category)?.label ?? "",
    };
    const look = [product, ...(video.also ?? []).flatMap((slug) => productBySlug.get(slug) ?? [])];
    const author = authors.get(video.id);
    const ref = author ? codes.get(author) : undefined;
    const by = author ? creators.get(author) : undefined;
    const creator = by ? { handle: by.handle, name: by.name, avatar: by.avatar } : undefined;
    return [{ video, product, seller, related, look, ...(ref ? { ref } : {}), ...(creator ? { creator } : {}) }];
  });
}

async function productsBySlug(slugs: string[]): Promise<ProductView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return (await services()).catalog.getProductsBySlugs(slugs);
}

/** A page of the ranked For You feed. */
export async function getFeedPage(offset: number, limit: number): Promise<FeedPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAG, FEED_TAG, CATALOG_TAG);
  const order = await getFeedOrder();
  const ids = order.slice(offset, offset + limit);
  const items = await assemble(await getVideosByIds(ids));
  return { items, next: offset + limit < order.length ? offset + limit : null };
}

/** Videos from the shops and people someone follows, newest first. */
export async function getFollowingPage(sellerIds: string[], authorIds: string[], offset: number, limit: number): Promise<FeedPage> {
  // One extra tells whether there's another page.
  const videos = await getFollowingVideos([...new Set(sellerIds)].sort(), [...new Set(authorIds)].sort(), offset, limit + 1);
  return { items: await assemble(videos.slice(0, limit)), next: videos.length > limit ? offset + limit : null };
}

/** Specific videos, e.g. the one a shared link opens. */
export async function getFeedItems(ids: string[]): Promise<FeedItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAG, FEED_TAG, CATALOG_TAG);
  return assemble(await getVideosByIds(ids));
}
