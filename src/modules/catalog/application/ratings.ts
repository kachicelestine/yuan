import type { ProductRepository, SellerRepository } from "../domain/repositories";

/** Keeps product ratings in step with the reviews content publishes. */
export function makeRatings({ products, sellers }: { products: ProductRepository; sellers?: SellerRepository }) {
  return {
    /** Folds a review's stars into its product's average; a second delivery changes nothing. */
    apply: (reviewId: string, productSlug: string, rating: number) => products.applyRating(reviewId, productSlug, rating),
    /** Counts a paid order into its products' sold counts, once. */
    sales: (orderId: string, lines: readonly { slug: string; qty: number }[]) => products.applySales(orderId, lines),
    /** An order lapsed unpaid: the stock it took goes back on sale. */
    releaseStock: (orderId: string) => products.releaseStock(orderId),
    /** Sets each storefront's follower count to the real one; returns the shops that changed. */
    async followers(counts: ReadonlyMap<string, number>): Promise<string[]> {
      if (!sellers) return [];
      const changed: string[] = [];
      for (const s of await sellers.list()) {
        const n = counts.get(s.id) ?? 0;
        if (!s.storefront || s.storefront.followers === n) continue;
        await sellers.save({ ...s, storefront: { ...s.storefront, followers: n } });
        changed.push(s.id);
      }
      return changed;
    },
  };
}
