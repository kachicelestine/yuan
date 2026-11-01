"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { useStore } from "@/components/providers";
import { Sheet, type Detent } from "@/components/sheet";
import { formatMoney } from "@/lib/format";
import type { Region } from "@/lib/types";

const regions: Region[] = ["Africa", "Europe", "Americas", "Asia-Pacific", "Middle East"];

type Variant = "chip" | "row" | "link" | "country";

/** Where we ship to. Picking a country changes currency, taxes, delivery and payment options everywhere. */
export function ShipTo({ variant = "chip", className = "" }: { variant?: Variant; className?: string }) {
  const { market } = useStore();
  const [detent, setDetent] = useState<Detent>("closed");
  const open = () => setDetent("half");

  return (
    <>
      {variant === "chip" && (
        <button
          type="button"
          onClick={open}
          aria-label={`Ship to ${market.name}, prices in ${market.currency}. Change`}
          className={`glass flex h-11 items-center gap-2 rounded-full pr-3.5 pl-3 text-[13px] font-semibold ${className}`}
        >
          <Flag code={market.code} className="size-5" />
          {market.currency}
        </button>
      )}
      {variant === "row" && (
        <button type="button" onClick={open} className={`glass flex w-full items-center gap-3 rounded-[24px] p-3.5 text-left ${className}`}>
          <Flag code={market.code} className="size-11" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink-2">Ship to</span>
            <span className="block truncate text-[15px] font-semibold">
              {market.city}, {market.name} · {market.currency}
            </span>
          </span>
          <Icon name="forward" className="size-5 text-ink-2" />
        </button>
      )}
      {variant === "country" && (
        <button type="button" onClick={open} aria-label={`Country: ${market.name}. Change`} className={`glass-inset flex w-full items-center gap-3 p-3 text-left ${className}`}>
          <Flag code={market.code} className="size-7" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-ink-2">Country</span>
            <span className="block truncate text-[15px] font-semibold">{market.name}</span>
          </span>
          <span className="text-[13px] font-semibold text-ink underline decoration-white/30 underline-offset-2">Change</span>
        </button>
      )}
      {variant === "link" && (
        <button type="button" onClick={open} className={`font-semibold text-ink underline decoration-white/30 underline-offset-2 ${className}`}>
          Change
        </button>
      )}
      <Sheet detent={detent} onDetent={setDetent} label="Ship to">
        <MarketList onPicked={() => setDetent("closed")} onClose={() => setDetent("closed")} />
      </Sheet>
    </>
  );
}

function MarketList({ onPicked, onClose }: { onPicked: () => void; onClose: () => void }) {
  const { markets, market, setMarket } = useStore();
  const [query, setQuery] = useState("");
  const id = useId();
  const q = query.trim().toLowerCase();
  const shown = markets.filter((m) => !q || [m.name, m.city, m.currency].some((s) => s.toLowerCase().includes(q)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 touch-none flex-col gap-3 px-4 pt-1 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">Ship to</h2>
            <p className="text-[13px] text-ink-2">Prices, taxes, delivery dates and payment options follow your country.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="glass-inset grid size-9 shrink-0 place-items-center rounded-full">
            <Icon name="close" className="size-[18px]" />
          </button>
        </div>
        <label htmlFor={id} className="glass-inset flex h-11 items-center gap-2.5 rounded-full px-4">
          <Icon name="search" className="size-[18px] text-ink-2" />
          <span className="sr-only">Search countries</span>
          <input
            id={id}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Country, city or currency"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3"
          />
        </label>
      </header>
      <div data-sheet-scroll className="no-scrollbar pb-safe min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        {regions.map((region) => {
          const list = shown.filter((m) => m.region === region);
          if (!list.length) return null;
          return (
            <section key={region} aria-label={region} className="mb-4">
              <h3 className="mb-1.5 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">{region.toUpperCase()}</h3>
              <ul className="glass-inset flex flex-col divide-y divide-line overflow-hidden rounded-[20px]">
                {list.map((m) => {
                  const on = m.code === market.code;
                  return (
                    <li key={m.code}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setMarket(m.code);
                          onPicked();
                        }}
                        className={`flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${on ? "bg-white/10" : "hover:bg-white/5"}`}
                      >
                        <Flag code={m.code} className="size-8" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold">{m.name}</span>
                          <span className="block truncate text-xs text-ink-2">
                            {m.currency} · {m.city}
                          </span>
                        </span>
                        <span className="text-right text-[11px] font-semibold text-ink-3">$1 = {formatMoney(m.rate, m.currency)}</span>
                        {on && <Icon name="check" className="size-5 text-positive" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {!shown.length && <p className="px-1 py-6 text-center text-sm text-ink-2">We don&apos;t ship there yet.</p>}
      </div>
    </div>
  );
}

