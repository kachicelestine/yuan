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
}

/** Read side of products. Only active listings come back unless noted. */
export interface ProductRepository {
  findBySlug(slug: string): Promise<Product | null>;
  list(filter?: { categoryId?: CategoryId; sellerId?: SellerId; limit?: number }): Promise<Product[]>;
  /** Every active product's slug, for static generation. */
  slugs(): Promise<string[]>;
  save(product: Product): Promise<void>;
}
