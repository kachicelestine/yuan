"use client";

import { useEffect, useState } from "react";
import type { Product, ProductFilters, ProductSort } from "@/lib/catalog";

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

type State = { key: string; products: Product[]; failed: boolean };

/**
 * Products for a search, fetched from the catalog as the shopper types. Requests are
 * debounced and cancelled when the query changes; the last results stay on screen
 * while the next ones load, so the grid never flashes empty.
 */
export function useProductSearch(text: string, filters: ProductFilters, sort: ProductSort) {
  const key = searchParamsFor(text, filters, sort);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?${key}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`search ${res.status}`);
        const body = (await res.json()) as { products: Product[] };
        setState({ key, products: body.products, failed: false });
      } catch {
        if (!controller.signal.aborted) setState((s) => ({ key, products: s?.products ?? [], failed: true }));
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  return { products: state?.products ?? [], loading: state?.key !== key, failed: state?.key === key && state.failed };
}
