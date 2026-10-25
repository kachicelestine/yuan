"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import type { Product } from "@/lib/catalog";
import { useStored } from "@/lib/use-stored";

export type Watch = { slug: string; target: number; autoBuy: boolean };

const W = 320;
const H = 112;
const drops = [0.05, 0.1, 0.15, 0.2];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;

/**
 * The price as we've recorded it each day (up to 90 days), and a watch: get told when it
 * drops to your target, and optionally have it put in your bag.
 */
export function PriceHistory({ product, history }: { product: Product; history: { date: string; price: number }[] }) {
  const money = useMoney();
  const points = useMemo(() => {
    const list = history.map((h) => ({ date: label(h.date), price: h.price }));
    // Today's price, if the day's record hasn't been taken yet.
    if (product.price !== undefined && (!list.length || list.at(-1)!.price !== product.price)) list.push({ date: "Today", price: product.price });
    return list.length === 1 ? [list[0], list[0]] : list;
  }, [history, product.price]);
  const [hover, setHover] = useState<number | null>(null);
  const [watches, setWatches] = useStored<Watch[]>("app.watches", []);
  const watch = watches.find((w) => w.slug === product.slug);
  const now = product.price ?? 0;

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const low = prices.indexOf(min);
  const pad = (max - min) * 0.15 || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - (min - pad)) / (max + pad - (min - pad))) * H;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join("");
  const area = `${line}L${W},${H}L0,${H}Z`;
  const pct = (i: number) => `${(i / (points.length - 1)) * 100}%`;
  const top = (v: number) => `${(y(v) / H) * 100}%`;
  const shown = hover ?? points.length - 1;
  // Only claim "lowest" with enough history to mean something.
  const isLowest = history.length >= 14 && now <= min + 0.01;
  const span = history.length;

  function save(next: Watch | null) {
    setWatches([...watches.filter((w) => w.slug !== product.slug), ...(next ? [next] : [])]);
  }

  return (
    <section aria-labelledby={`ph-${product.slug}`} className="glass-inset rounded-[24px] p-4">
      <header className="flex items-start gap-3">
        <div className="flex-1">
          <h3 id={`ph-${product.slug}`} className="text-[15px] font-bold">
            {span >= 90 ? "Price, last 90 days" : "Price history"}
          </h3>
          <p className="text-xs text-ink-2">
            {span >= 2 ? (
              <>
                Low {money(min)} · High {money(max)} · tracked since {points[0].date}
              </>
            ) : (
              <>We started tracking this price today. The chart fills in day by day.</>
            )}
          </p>
        </div>
        {isLowest && (
          <span className="flex items-center gap-1 rounded-full bg-positive/15 px-2.5 py-1 text-[11px] font-bold text-positive">
            <Icon name="check" className="size-3.5" />
            Lowest since {points[0].date}
          </span>
        )}
      </header>

      {span >= 2 && (
        <>
      <div
        role="img"
        tabIndex={0}
        aria-label={`Price since ${points[0].date}, from ${money(points[0].price)} to ${money(now)} today. Lowest ${money(min)} on ${points[low].date}. Use the arrow keys to read each day.`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(points.length - 1, Math.round(((e.clientX - box.left) / box.width) * (points.length - 1)))));
        }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setHover(Math.max(0, Math.min(points.length - 1, shown + (e.key === "ArrowLeft" ? -1 : 1))));
          }
          if (e.key === "Escape") setHover(null);
        }}
        className="relative mt-3 h-[112px] touch-pan-y rounded-lg outline-offset-4"
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
          {[0.25, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgb(255 255 255 / 0.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} className="fill-series" fillOpacity="0.1" />
          <path d={line} fill="none" className="stroke-series" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {hover !== null && <span aria-hidden="true" className="absolute inset-y-0 w-px bg-white/40" style={{ left: pct(hover) }} />}
        {[low, shown].map((i, k) => (
          <span
            key={k}
            aria-hidden="true"
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-series ring-2 ring-[#1d1d22]"
            style={{ left: pct(i), top: top(points[i].price) }}
          />
        ))}
        {hover === null && low !== points.length - 1 && (
          <span aria-hidden="true" className="absolute -translate-x-1/2 translate-y-2 text-[10.5px] font-semibold text-ink-2" style={{ left: pct(low), top: top(min) }}>
            Low
          </span>
        )}
        <span
          aria-hidden="true"
          className="glass absolute -top-2 flex flex-col rounded-xl px-2.5 py-1.5 text-right whitespace-nowrap"
          style={{ left: pct(shown), transform: `translate(${shown >= (points.length - 1) * 0.6 ? "-105%" : "8%"}, 0)` }}
        >
          <b className="font-display text-sm font-bold">{money(points[shown].price)}</b>
          <span className="text-[10.5px] text-ink-2">{hover === null ? "Today" : points[shown].date}</span>
        </span>
      </div>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-[10.5px] text-ink-3">
        <span>{points[0].date}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)].date}</span>}
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>Price each week</caption>
        <tbody>
          {points
            .filter((_, i) => i % 7 === 0 || i === points.length - 1)
            .map((p) => (
              <tr key={p.date}>
                <th scope="row">{p.date}</th>
                <td>{money(p.price)}</td>
              </tr>
            ))}
        </tbody>
      </table>
        </>
      )}

      {product.price !== undefined && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-[13px] font-semibold">{watch ? "Watching this price" : "Tell me when it drops to"}</p>
          <div className="flex flex-wrap gap-2">
            {drops.map((d) => {
              const target = Math.round(now * (1 - d) * 100) / 100;
              const on = watch && Math.abs(watch.target - target) < 0.01;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={!!on}
                  onClick={() => save(on ? null : { slug: product.slug, target, autoBuy: watch?.autoBuy ?? false })}
                  className={`flex h-10 flex-col items-center justify-center rounded-2xl px-3 leading-tight transition-colors ${on ? "bg-white text-black" : "glass-inset"}`}
                >
                  <b className="text-[13px] font-bold">{money(target)}</b>
                  <span className={`text-[10px] ${on ? "text-black/60" : "text-ink-3"}`}>−{d * 100}%</span>
                </button>
              );
            })}
          </div>
          {watch && (
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <span className="relative mt-0.5 inline-flex">
                <input type="checkbox" role="switch" checked={watch.autoBuy} onChange={(e) => save({ ...watch, autoBuy: e.target.checked })} className="peer sr-only" />
                <span className="h-7 w-12 rounded-full bg-white/20 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-white" />
                <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-500 ease-spring peer-checked:translate-x-5" />
              </span>
              <span className="text-[13px] text-ink-2">
                <b className="font-semibold text-ink">Put it in my bag at {money(watch.target)}</b>
                <br />
                {watch.autoBuy ? "On. When it gets there, it goes in your bag and we tell you." : "Off. We'll just tell you."}
              </span>
            </label>
          )}
        </div>
      )}
    </section>
  );
}

