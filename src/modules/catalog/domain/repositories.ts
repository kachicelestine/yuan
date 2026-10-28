import type { Category, CategoryId } from "./category";
import type { Product } from "./product";
import type { Seller, SellerId } from "./seller";

export interface CategoryRepository {
  list(): Promise<Category[]>;
  findById(id: CategoryId): Promise<Category | null>;
}

export interface SellerRepository {
  list(): Promise<Seller[]>;
  findById(id: SellerId): Promise<Seller | null>;
  findByIds(ids: readonly SellerId[]): Promise<Seller[]>;
  save(seller: Seller): Promise<void>;
  setSuspension(id: string, at: Date | null, reason: string | null): Promise<void>;
}

/** Read side of products. Only active listings come back unless noted. */
export interface ProductRepository {
  findBySlug(slug: string): Promise<Product | null>;
  findBySlugs(slugs: readonly string[]): Promise<Product[]>;
  list(filter?: { categoryId?: CategoryId; sellerId?: SellerId; limit?: number }): Promise<Product[]>;
  /** Every active product's slug, for static generation. */
  slugs(): Promise<string[]>;
  /** Any status: sellers see their drafts and archived listings. */
  findById(id: string): Promise<Product | null>;
  /** A shop's listings in every status, newest first. */
  listBySeller(sellerId: SellerId): Promise<Product[]>;
  slugExists(slug: string): Promise<boolean>;
  /** Folds one review's stars into the product's average, once per review id. */
  applyRating(reviewId: string, slug: string, rating: number): Promise<boolean>;
  /** Records today's price of every live, priced listing (re-running the same day updates it). */
  recordPrices(day: string): Promise<number>;
  /** Recorded prices since `sinceDay`, oldest first. */
  priceHistory(slug: string, sinceDay: string): Promise<{ day: string; price: number }[]>;
  /** Current prices of these listings (live ones with a price). */
  prices(slugs: readonly string[]): Promise<Map<string, number>>;
  /** Adds a paid order's quantities to its products' sold counts; a second delivery changes nothing. */
  applySales(orderId: string, lines: readonly { slug: string; qty: number }[]): Promise<boolean>;
  /**
   * Takes stock for an order being placed, all or nothing: listings that count stock must
   * have enough. Returns the first one short, with how many it has left, or null when done.
   */
  reserveStock(orderId: string, lines: readonly { slug: string; qty: number }[]): Promise<{ slug: string; left: number } | null>;
  /** Gives back what an order that lapsed unpaid had taken; a second call does nothing. */
  releaseStock(orderId: string): Promise<number>;
  save(product: Product): Promise<void>;
  /** Moves every listing of a shop from one status to another; returns how many. */
  setStatusForSeller(sellerId: string, from: Product["status"], to: Product["status"]): Promise<number>;
}
