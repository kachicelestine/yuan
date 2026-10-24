"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product/product-card";
import { Chip } from "@/components/search/filters-sheet";
import { rankProducts, type Product, type ProductSort } from "@/lib/catalog";

const sorts: { id: ProductSort; label: string }[] = [
  { id: "sold", label: "Best selling" },
  { id: "rating", label: "Top rated" },
  { id: "price-asc", label: "Lowest price" },
];

/** A category's products, narrowed by subcategory chips and sorted. */
export function CategoryShelf({ items, subcategories }: { items: Product[]; subcategories: string[] }) {
  const [sub, setSub] = useState<string | null>(null);
  const [sort, setSort] = useState<ProductSort>("sold");
  const products = useMemo(() => rankProducts(items, sub ?? "", {}, sort), [items, sub, sort]);

  return (
    <section aria-label="Products">
      <div className="no-scrollbar -mx-3.5 flex gap-2 overflow-x-auto px-3.5 lg:mx-0 lg:px-0">
        <Chip on={sub === null} onClick={() => setSub(null)}>
          All
        </Chip>
        {subcategories.map((s) => (
          <Chip key={s} on={sub === s} onClick={() => setSub(sub === s ? null : s)}>
            {s}
          </Chip>
        ))}
      </div>
      <div className="mt-3 mb-3 flex items-center justify-between">
        <p className="text-[13px] text-ink-2" aria-live="polite">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
        <div role="group" aria-label="Sort" className="flex gap-1">
          {sorts.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sort === s.id}
              onClick={() => setSort(s.id)}
              className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${sort === s.id ? "glass-selected text-ink" : "text-ink-2 hover:text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((p, i) => (
          <li key={p.slug}>
            <ProductCard product={p} eager={i < 2} sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}

