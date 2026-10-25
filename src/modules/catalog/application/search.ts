import type { Cents, Clock } from "@/shared/kernel";
import type { Product } from "../domain/product";
import type { SellerRepository } from "../domain/repositories";
import type { Seller, SellerKind } from "../domain/seller";
import { toProductView, toSellerView, type ProductView, type SellerView } from "./views";

export const PRODUCT_SORTS = ["best", "price-asc", "price-desc", "rating", "sold"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** What a shopper asked for. Prices are in cents; "fast" means at the door within `fastDays`. */
export type SearchCriteria = {
  text: string;
  minPrice?: Cents;
  maxPrice?: Cents;
  categories?: string[];
  minRating?: number;
  sellerKinds?: SellerKind[];
  onSale?: boolean;
  bulk?: boolean;
  fast?: boolean;
  verified?: boolean;
  /** Only these products (e.g. the ones shops are advertising). */
  slugs?: readonly string[];
  sort: ProductSort;
  limit: number;
};

/** Days that count as fast delivery for the "fast" filter. */
export const FAST_DAYS = 10;

/** The search engine behind the catalog: Postgres full-text today, a dedicated service later. */
export interface ProductSearch {
  search(criteria: SearchCriteria): Promise<Product[]>;
}

/** A shop that matches a search, by its own name, city or bio or by what it sells. */
export type ShopHit = Readonly<{ seller: Seller; /** Its live listings that match. */ matching: number; /** Photos of up to three of them. */ preview: readonly string[] }>;

export interface ShopSearch {
  /** Shops named like the search first, then those with the most matching listings. */
  shops(text: string, limit: number): Promise<ShopHit[]>;
}

export type ShopResult = SellerView & { rating: number; followers: number; responseHours: number | null; matching: number; preview: string[] };

export function makeSearchShops(deps: { search: ShopSearch }) {
  return async function searchShops(text: string, limit = 20): Promise<ShopResult[]> {
    if (!text.trim()) return [];
    return (await deps.search.shops(text, limit)).map(({ seller, matching, preview }) => ({
      ...toSellerView(seller),
      rating: seller.storefront?.rating ?? 0,
      followers: seller.storefront?.followers ?? 0,
      responseHours: seller.storefront?.responseHours ?? null,
      matching,
      preview: [...preview],
    }));
  };
}

export function makeSearchProducts(deps: { search: ProductSearch; sellers: SellerRepository; clock: Clock }) {
  return async function searchProducts(criteria: SearchCriteria): Promise<ProductView[]> {
    const found = await deps.search.search(criteria);
    const owners = new Map((await deps.sellers.findByIds([...new Set(found.map((p) => p.sellerId))])).map((s) => [s.id, s]));
    const today = deps.clock.now();
    return found.map((p) => toProductView(p, today, owners.get(p.sellerId)));
  };
}
