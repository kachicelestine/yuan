import type { ProductRepository } from "@/modules/catalog";
import type { LiveCatalog } from "@/modules/live";

/** Live puts on air only what the shop sells (live never reads catalog tables). */
export class CatalogForLive implements LiveCatalog {
  constructor(private readonly products: ProductRepository) {}

  async owned(sellerId: string, slugs: readonly string[]) {
    return (await this.products.findBySlugs(slugs)).filter((p) => p.sellerId === sellerId).map((p) => p.slug);
  }
}
