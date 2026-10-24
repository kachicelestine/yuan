// Review queries over the fixtures; summaries are derived until real review data exists.
import { products } from "@/fixtures/products";
import { questions, reviews } from "@/fixtures/reviews";
import type { Product } from "./types";

export function reviewsFor(slug: string) {
  return reviews.filter((r) => r.productSlug === slug);
}

export function questionsFor(slug: string) {
  return questions.filter((q) => q.productSlug === slug);
}

export function reviewsForSeller(sellerId: string) {
  const slugs = new Set(products.filter((p) => p.sellerId === sellerId).map((p) => p.slug));
  return reviews.filter((r) => slugs.has(r.productSlug));
}

// A small stable number per product, so derived scores differ between products but never change.
function wobble(slug: string, salt: number) {
  let h = salt;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h / 997 - 0.5) * 0.3;
}

const clamp = (n: number) => Math.round(Math.min(5, Math.max(1, n)) * 10) / 10;

export type ReviewSummary = {
  /** Counts for 5, 4, 3, 2 and 1 stars. */
  stars: number[];
  aspects: { label: string; score: number }[];
};

/** Star distribution and aspect scores consistent with the product's rating and review count. */
export function reviewSummary(p: Product): ReviewSummary {
  const five = Math.min(0.92, Math.max(0.3, (p.rating - 3.5) / 1.5));
  const rest = 1 - five;
  const shares = [five, rest * 0.6, rest * 0.22, rest * 0.08, rest * 0.1];
  return {
    stars: shares.map((s) => Math.round(s * p.reviews)),
    aspects: [
      { label: "Quality", score: clamp(p.rating + wobble(p.slug, 1)) },
      { label: "As described", score: clamp(p.rating - 0.05 + wobble(p.slug, 2)) },
      { label: "Value", score: clamp(p.rating + 0.1 + wobble(p.slug, 3)) },
      { label: "Shipping", score: clamp(p.rating - 0.25 + wobble(p.slug, 4)) },
    ],
  };
}

