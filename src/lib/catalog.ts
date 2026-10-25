// The query layer. Pages and components read data only through this module (and the
// small query modules it re-exports), so the fixtures in src/fixtures can be swapped
// for the database without touching the UI.
import { categories } from "@/fixtures/categories";
import { notes } from "@/fixtures/notes";
import { products } from "@/fixtures/products";
import { profiles } from "@/fixtures/profiles";
import { snapFallback, snapSamples, trendingSearches } from "@/fixtures/search";
import { sellers } from "@/fixtures/sellers";
import { towns } from "@/fixtures/towns";
import { videos } from "@/fixtures/videos";
import type { CategoryId, Product } from "./types";

export type * from "./types";
export { priceHistory } from "./prices";
export type { PricePoint } from "./prices";
export { questionsFor, reviewSummary, reviewsFor, reviewsForSeller } from "./reviews";
export type { ReviewSummary } from "./reviews";
export { categories, sellers, products, videos, notes, trendingSearches, snapSamples, snapFallback, towns };
export { daysToDelivery, matchesFilters, rankProducts, searchProducts, searchSellers, searchVideos, understand } from "./search";
export type { ProductFilters, ProductSort, Understood } from "./search";

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function getSeller(id: string) {
  return sellers[id];
}

export function productsBySeller(sellerId: string, exclude?: string) {
  return products.filter((p) => p.sellerId === sellerId && p.slug !== exclude);
}

/** Items in the same category from other sellers, for "similar" rails. */
export function similarProducts(product: Product, limit = 4) {
  return products.filter((p) => p.category === product.category && p.sellerId !== product.sellerId).slice(0, limit);
}

/** Unit price for a quantity after volume tiers and an option surcharge. */
export function unitPrice(product: Product, qty: number, delta = 0) {
  const base = product.price ?? 0;
  const tier = [...(product.tiers ?? [])].reverse().find((t) => qty >= t.min);
  return (tier?.price ?? base) + delta;
}

export function getSellerProfile(id: string) {
  return profiles[id];
}

export function getCategory(id: string) {
  return categories.find((c) => c.id === id);
}

export function productsInCategory(id: CategoryId) {
  return products.filter((p) => p.category === id);
}

/** Sellers with at least one product in the category, biggest following first. */
export function sellersInCategory(id: CategoryId) {
  const ids = new Set(productsInCategory(id).map((p) => p.sellerId));
  return [...ids]
    .map((sid) => sellers[sid])
    .filter(Boolean)
    .sort((a, b) => (profiles[b.id]?.followers ?? 0) - (profiles[a.id]?.followers ?? 0));
}

export function videosForSeller(sellerId: string) {
  return videos.filter((v) => v.sellerId === sellerId);
}

export function videosInCategory(id: CategoryId) {
  return videos.filter((v) => products.find((p) => p.slug === v.productSlug)?.category === id);
}

export function notesInCategory(id: CategoryId) {
  return notes.filter((n) => n.category === id);
}

export function getTown(id: string) {
  return towns.find((t) => t.id === id);
}

