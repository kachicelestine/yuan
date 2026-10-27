"use client";

import { useEffect, useState } from "react";
import type { Product, ProductFilters, ProductSort } from "@/lib/catalog";
import type { SearchAll } from "@/lib/types";
import type { SponsoredItem } from "@/components/ads/sponsored";

/** The query string for GET /api/search. Sorted keys keep equal searches equal. */
export function searchParamsFor(text: string, f: ProductFilters, sort: ProductSort) {
  const p = new URLSearchParams();
  if (text) p.set("q", text);
  if (f.minPrice !== undefined) p.set("minPrice", String(Math.round(f.minPrice * 100) / 100));
  if (f.maxPrice !== undefined) p.set("maxPrice", String(Math.round(f.maxPrice * 100) / 100));
  if (f.categories?.length) p.set("cat", f.categories.join(","));
  if (f.minRating) p.set("rating", String(f.minRating));
  if (f.sellerKinds?.length) p.set("kind", f.sellerKinds.join(","));
  if (f.onSale) p.set("sale", "true");
  if (f.bulk) p.set("bulk", "true");
  if (f.fast) p.set("fast", "true");
  if (f.verified) p.set("verified", "true");
  if (sort !== "best") p.set("sort", sort);
  p.sort();
  return p.toString();
}

type State = { key: string; products: Product[]; sponsored: SponsoredItem[]; failed: boolean };

/**
 * Products for a search, fetched from the catalog as the shopper types. Requests are
 * debounced and cancelled when the query changes; the last results stay on screen
 * while the next ones load, so the grid never flashes empty.
 */
export function useProductSearch(text: string, filters: ProductFilters, sort: ProductSort, enabled = true) {
  const key = enabled ? searchParamsFor(text, filters, sort) : null;
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?${key}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`search ${res.status}`);
        const body = (await res.json()) as { products: Product[]; sponsored?: SponsoredItem[] };
        setState({ key, products: body.products, sponsored: body.sponsored ?? [], failed: false });
      } catch {
        if (!controller.signal.aborted) setState((s) => ({ key, products: s?.products ?? [], sponsored: [], failed: true }));
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  if (key === null) return { products: [], sponsored: [], loading: false, failed: false };
  return { products: state?.products ?? [], sponsored: state?.key === key ? state.sponsored : [], loading: state?.key !== key, failed: state?.key === key && state.failed };
}

const NOTHING: SearchAll = { videos: [], shops: [], live: [], people: [] };

/** Videos, shops and live rooms for a search (GET /api/search/all), debounced like products. */
export function useSearchAll(text: string) {
  const key = text.trim();
  const [state, setState] = useState<{ key: string; result: SearchAll } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/all?q=${encodeURIComponent(key)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`search ${res.status}`);
        setState({ key, result: (await res.json()) as SearchAll });
      } catch {
        if (!controller.signal.aborted) setState((s) => ({ key, result: s?.result ?? NOTHING }));
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  if (!key) return { ...NOTHING, loading: false };
  return { ...(state?.result ?? NOTHING), loading: state?.key !== key };
}
