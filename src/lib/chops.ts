// Price chops: a fixed target, a fixed number of equal cuts, and a fixed deadline.
import { chopHelpers, chops } from "@/fixtures/chops";
import type { Chop, Product } from "@/lib/types";

export { chopHelpers, chops };

export function getChop(id: string) {
  return chops.find((c) => c.id === id);
}

/** Every cut is the same size, so the tenth friend matters as much as the first. */
export function cutSize(chop: Chop, product: Product) {
  return ((product.price ?? 0) - chop.target) / chop.cuts;
}

export function priceAfter(chop: Chop, product: Product, done: number) {
  return Math.max(chop.target, (product.price ?? 0) - cutSize(chop, product) * done);
}
