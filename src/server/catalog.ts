import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { SearchCriteria } from "@/modules/catalog";
import { services } from "./container";

// Cached reads of the catalog. Every entry carries the `catalog` tag plus a precise one,
// so a seller editing a listing can invalidate just that product (see revalidateTag).
// An hour of freshness also keeps the "Arrives Nov 4–9" windows current.

export const CATALOG_TAG = "catalog";
export const productTag = (slug: string) => `product:${slug}`;
export const sellerTag = (id: string) => `seller:${id}`;

const catalog = async () => (await services()).catalog;

export async function getCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG, "categories");
  return (await catalog()).listCategories();
}

export async function getCategory(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG, `category:${id}`);
  return (await catalog()).getCategory(id);
}

export async function getProduct(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG, productTag(slug));
  return (await catalog()).getProduct(slug);
}

export async function getProducts(filter: { category?: string; seller?: string; limit?: number } = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG, ...(filter.seller ? [sellerTag(filter.seller)] : []));
  return (await catalog()).listProducts(filter);
}

export async function getSimilarProducts(slug: string, limit = 4) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return (await catalog()).similarProducts(slug, limit);
}

export async function getSellerPage(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG, sellerTag(id));
  return (await catalog()).getSeller(id);
}

export async function getSellersInCategory(category: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG, `category:${category}`);
  return (await catalog()).sellersInCategory(category);
}

export async function getSellers() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG, "sellers");
  return (await catalog()).listSellers();
}

export async function getProductSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return (await catalog()).productSlugs();
}

/** Product search. Short-lived cache: popular queries repeat, and listings change. */
export async function searchCatalog(criteria: SearchCriteria) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  return (await services()).searchProducts(criteria);
}
