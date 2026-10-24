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
  save(product: Product): Promise<void>;
}
