import type { ProductRepository } from "@/modules/catalog";
import type { ProductDirectory } from "@/modules/content";

/** Lets content check that a product exists (and whose it is) without reading catalog tables. */
export class CatalogProductDirectory implements ProductDirectory {
  constructor(private readonly products: ProductRepository) {}

  async find(slug: string) {
    const p = await this.products.findBySlug(slug);
    return p && { slug: p.slug, sellerId: p.sellerId, category: p.categoryId };
  }
}
