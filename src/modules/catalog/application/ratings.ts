import type { ProductRepository } from "../domain/repositories";

/** Keeps product ratings in step with the reviews content publishes. */
export function makeRatings({ products }: { products: ProductRepository }) {
  return {
    /** Folds a review's stars into its product's average; a second delivery changes nothing. */
    apply: (reviewId: string, productSlug: string, rating: number) => products.applyRating(reviewId, productSlug, rating),
    /** Counts a paid order into its products' sold counts, once. */
    sales: (orderId: string, lines: readonly { slug: string; qty: number }[]) => products.applySales(orderId, lines),
  };
}
