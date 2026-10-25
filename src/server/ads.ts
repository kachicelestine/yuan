import "server-only";
import type { ProductView, SearchCriteria } from "@/modules/catalog";
import { searchCatalog } from "./catalog";
import { services } from "./container";

// Sponsored slots. Which listings may fill a slot is a catalog question (does the
// advertised product match this search or category?), cached like any search; who wins
// and what a click costs is decided per request by the ads auction, never cached.

export type Sponsored = { product: ProductView; token: string };

export async function sponsored(criteria: Omit<SearchCriteria, "slugs" | "sort" | "limit">, slots: number): Promise<Sponsored[]> {
  const app = await services();
  const promoted = await app.ads.promoted();
  if (!promoted.length) return [];
  // Sorted, so the same advertised set makes the same cache key.
  const slugs = [...new Set(promoted.map((p) => p.slug))].sort();
  const matched = await searchCatalog({ ...criteria, slugs, sort: "best", limit: 50 });
  if (!matched.length) return [];
  const rank = new Map(matched.map((p, i) => [p.slug, i]));
  const eligible = promoted.filter((p) => rank.has(p.slug)).sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!);
  const bySlug = new Map(matched.map((p) => [p.slug, p]));
  return (await app.ads.serve(eligible, slots)).map((s) => ({ product: bySlug.get(s.slug)!, token: s.token }));
}
