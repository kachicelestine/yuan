import type { Cents, Clock } from "@/shared/kernel";
import type { Product } from "../domain/product";
import type { SellerRepository } from "../domain/repositories";
import type { SellerKind } from "../domain/seller";
import { toProductView, type ProductView } from "./views";

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
  sort: ProductSort;
  limit: number;
};

/** Days that count as fast delivery for the "fast" filter. */
export const FAST_DAYS = 10;

/** The search engine behind the catalog: Postgres full-text today, a dedicated service later. */
export interface ProductSearch {
  search(criteria: SearchCriteria): Promise<Product[]>;
}

export function makeSearchProducts(deps: { search: ProductSearch; sellers: SellerRepository; clock: Clock }) {
  return async function searchProducts(criteria: SearchCriteria): Promise<ProductView[]> {
    const found = await deps.search.search(criteria);
    const owners = new Map((await deps.sellers.findByIds([...new Set(found.map((p) => p.sellerId))])).map((s) => [s.id, s]));
    const today = deps.clock.now();
    return found.map((p) => toProductView(p, today, owners.get(p.sellerId)));
  };
}
