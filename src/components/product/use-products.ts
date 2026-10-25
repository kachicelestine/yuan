"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/catalog";

// Listings by slug from the catalog (GET /api/products), remembered for the session so
// the saved list, boards and pickers share one copy.
const known = new Map<string, Product | null>();

async function load(slugs: readonly string[]) {
  const missing = slugs.filter((s) => !known.has(s));
  for (let i = 0; i < missing.length; i += 200) {
    const batch = missing.slice(i, i + 200);
    const res = await fetch(`/api/products?slugs=${batch.map(encodeURIComponent).join(",")}`);
    if (!res.ok) throw new Error(`products ${res.status}`);
    const { products } = (await res.json()) as { products: Product[] };
    const found = new Map(products.map((p) => [p.slug, p]));
    // A slug the catalog doesn't return was removed or hidden: remember that too.
    for (const s of batch) known.set(s, found.get(s) ?? null);
  }
}

/** The listings for these slugs, in order, leaving out ones that no longer exist. */
export function useProducts(slugs: readonly string[]) {
  const key = slugs.join(",");
  const [state, setState] = useState<{ key: string; failed: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    const list = key ? key.split(",") : [];
    load(list).then(
      () => live && setState({ key, failed: false }),
      () => live && setState({ key, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [key]);

  const ready = state?.key === key || slugs.every((s) => known.has(s));
  const products = slugs.flatMap((s) => known.get(s) ?? []);
  return { products, loading: !ready, failed: state?.key === key && state.failed };
}

/** Listings like this one (same category, similar price), for "goes well with" rows. */
export function useSimilar(slug: string | null) {
  const [state, setState] = useState<{ slug: string; products: Product[] } | null>(null);
  useEffect(() => {
    if (!slug) return;
    let live = true;
    fetch(`/api/products?similar=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ products: Product[] }>) : { products: [] }))
      .then(
        (body) => live && setState({ slug, products: body.products }),
        () => {},
      );
    return () => {
      live = false;
    };
  }, [slug]);
  return state?.slug === slug ? state.products : [];
}

/** Seeds the session copy with listings the server already sent. */
export function rememberProducts(products: readonly Product[]) {
  for (const p of products) known.set(p.slug, p);
}
