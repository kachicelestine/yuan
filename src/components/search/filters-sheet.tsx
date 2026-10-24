"use client";

import { useId } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import type { CategoryId, ProductFilters, SellerKind } from "@/lib/catalog";

const ratings = [4, 4.5, 4.8];
const kinds: SellerKind[] = ["Factory", "Brand", "Maker", "Exporter"];

type Props = {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  categories: { id: CategoryId; label: string }[];
  count: number;
  onDone: () => void;
};

/** Every filter in one sheet; prices are typed in the shopper's own currency. */
export function FiltersSheet({ filters, onChange, categories, count, onDone }: Props) {
  const { market } = useStore();
  const id = useId();
  const set = (patch: Partial<ProductFilters>) => onChange({ ...filters, ...patch });
  const toLocal = (usd?: number) => (usd === undefined ? "" : String(Math.round(usd * market.rate)));
  const toUsd = (local: string) => (local.trim() === "" ? undefined : Number(local) / market.rate);
  const toggle = <T,>(list: T[] | undefined, value: T) => (list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 touch-none items-center gap-3 px-4 pt-1 pb-3">
        <h2 className="flex-1 font-display text-[22px] font-bold tracking-[-0.02em]">Filters</h2>
        <button type="button" onClick={() => onChange({})} className="glass-inset h-9 rounded-full px-3.5 text-[13px] font-semibold">
          Reset
        </button>
        <button type="button" onClick={onDone} aria-label="Close" className="glass-inset grid size-9 place-items-center rounded-full">
          <Icon name="close" className="size-[18px]" />
        </button>
      </header>
      <div data-sheet-scroll className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 pb-4">
        <fieldset>
          <legend className="mb-2 text-[15px] font-bold">Price ({market.currency})</legend>
          <div className="flex items-center gap-2">
            {(["min", "max"] as const).map((end) => (
              <label key={end} htmlFor={`${id}-${end}`} className="glass-inset flex h-12 flex-1 flex-col justify-center rounded-2xl px-3.5">
                <span className="text-[10.5px] font-semibold text-ink-3">{end === "min" ? "Minimum" : "Maximum"}</span>
                <input
                  id={`${id}-${end}`}
                  inputMode="numeric"
                  value={toLocal(end === "min" ? filters.minPrice : filters.maxPrice)}
                  onChange={(e) => set(end === "min" ? { minPrice: toUsd(e.target.value) } : { maxPrice: toUsd(e.target.value) })}
                  placeholder={end === "min" ? "0" : "Any"}
                  className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-ink-3"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[15px] font-bold">Deals</legend>
          <div className="flex flex-wrap gap-2">
            <Chip on={!!filters.onSale} onClick={() => set({ onSale: !filters.onSale })}>
              On sale
            </Chip>
            <Chip on={!!filters.bulk} onClick={() => set({ bulk: !filters.bulk })}>
              Bulk pricing
            </Chip>
            <Chip on={!!filters.fast} onClick={() => set({ fast: !filters.fast })}>
              Arrives in 10 days
            </Chip>
            <Chip on={!!filters.verified} onClick={() => set({ verified: !filters.verified })}>
              Audited factory
            </Chip>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[15px] font-bold">Rating</legend>
          <div className="flex flex-wrap gap-2">
            {ratings.map((r) => (
              <Chip key={r} on={filters.minRating === r} onClick={() => set({ minRating: filters.minRating === r ? undefined : r })}>
                <Icon name="star" filled className="size-3.5 text-save" />
                {r}+
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[15px] font-bold">Sold by</legend>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <Chip key={k} on={!!filters.sellerKinds?.includes(k)} onClick={() => set({ sellerKinds: toggle(filters.sellerKinds, k) })}>
                {k === "Factory" && <Icon name="factory" className="size-3.5" />}
                {k}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[15px] font-bold">Category</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c.id} on={!!filters.categories?.includes(c.id)} onClick={() => set({ categories: toggle(filters.categories, c.id) })}>
                {c.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="edge-bottom pb-safe shrink-0 px-4 pt-3">
        <button type="button" onClick={onDone} disabled={count === 0} className="h-[52px] w-full rounded-full bg-accent text-[15px] font-bold disabled:opacity-50">
          {count === 0 ? "No matches, loosen a filter" : `Show ${count} ${count === 1 ? "result" : "results"}`}
        </button>
      </div>
    </div>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${on ? "bg-white text-black" : "glass-inset text-ink-2 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

