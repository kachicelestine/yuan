"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/lib/catalog";

export type SponsoredItem = { product: Product; token: string };

/** Reports a tap on a sponsored listing; the shop pays for it once. */
function reportClick(token: string) {
  try {
    if (!navigator.sendBeacon?.("/api/ads/click", token)) void fetch("/api/ads/click", { method: "POST", body: token, keepalive: true });
  } catch {
    // The tap still opens the product.
  }
}

/** A product card in a sponsored slot: labelled as such, and its taps reported. */
export function SponsoredCard({ item, sizes, eager }: { item: SponsoredItem; sizes: string; eager?: boolean }) {
  return (
    <div className="relative" onClickCapture={() => reportClick(item.token)}>
      <ProductCard product={item.product} sizes={sizes} eager={eager} />
      <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-white/90 backdrop-blur-sm">Sponsored</span>
    </div>
  );
}

/**
 * Mixes sponsored listings into a results list: the first at the top, the next after four
 * results, and never the same product twice.
 */
export function withSponsored<T extends { slug: string }>(organic: readonly T[], sponsored: readonly SponsoredItem[]): ({ kind: "organic"; product: T } | { kind: "sponsored"; item: SponsoredItem })[] {
  const ads = sponsored.filter((s, i, all) => all.findIndex((x) => x.product.slug === s.product.slug) === i);
  const taken = new Set(ads.map((s) => s.product.slug));
  const rest = organic.filter((p) => !taken.has(p.slug)).map((product) => ({ kind: "organic" as const, product }));
  const out: ({ kind: "organic"; product: T } | { kind: "sponsored"; item: SponsoredItem })[] = [...rest];
  ads.forEach((item, i) => out.splice(Math.min(out.length, i === 0 ? 0 : 4 * i + i), 0, { kind: "sponsored", item }));
  return out;
}

/** Sponsored listings for a category page, fetched after it loads (the page itself stays static). */
export function useCategorySponsored(category: string) {
  const [items, setItems] = useState<SponsoredItem[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ads?category=${encodeURIComponent(category)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { sponsored: [] }))
      .then((b: { sponsored: SponsoredItem[] }) => setItems(b.sponsored))
      .catch(() => {});
    return () => controller.abort();
  }, [category]);
  return items;
}
