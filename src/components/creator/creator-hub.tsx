"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { creatorLinks, creatorWeeks, sampleOffers } from "@/lib/account";
import { getProduct } from "@/lib/catalog";
import { compact, niceCeil } from "@/lib/format";
import { useStored } from "@/lib/use-stored";

/** Earn by posting what you buy: earnings, links, free samples and payouts. */
export function CreatorHub() {
  const money = useMoney();
  const { market } = useStore();
  const [hover, setHover] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [samples, setSamples] = useStored<string[]>("app.samples", []);

  const month = creatorWeeks.slice(-4).reduce((n, w) => n + w.earned, 0);
  const before = creatorWeeks.slice(-8, -4).reduce((n, w) => n + w.earned, 0);
  const delta = (month - before) / before;
  const clicks = creatorLinks.reduce((n, l) => n + l.clicks, 0);
  const orders = creatorLinks.reduce((n, l) => n + l.orders, 0);
  const max = Math.max(...creatorWeeks.map((w) => w.earned));
  // Axis ticks are clean numbers in the shopper's own currency.
  const top = niceCeil(max * market.rate) / market.rate;
  const shown = hover ?? creatorWeeks.length - 1;

  return (
    <div className="mx-auto max-w-[900px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">Creator hub</h1>
          <p className="text-xs text-ink-2">Post what you love. Earn on every order your links bring in.</p>
        </div>
      </header>

      <section aria-label="This month" className="grid grid-cols-3 gap-2.5 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="glass col-span-3 rounded-[24px] p-4 lg:col-span-1">
          <p className="text-xs font-semibold text-ink-2">Earned, last 4 weeks</p>
          <p className="font-display text-[34px] leading-tight font-extrabold tracking-[-0.03em]">{money(month)}</p>
          <p className="flex items-center gap-1 text-xs font-semibold text-positive">
            <Icon name="up" className="size-3.5" />
            {Math.round(delta * 100)}% vs the 4 weeks before
          </p>
        </div>
        {[
          ["Clicks", compact(clicks)],
          ["Orders", orders.toLocaleString("en-US")],
          ["Conversion", `${((orders / clicks) * 100).toFixed(1)}%`],
        ].map(([label, value]) => (
          <div key={label} className="glass-inset rounded-[24px] p-4">
            <p className="text-xs font-semibold text-ink-2">{label}</p>
            <p className="font-display text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="weekly-h" className="glass mt-4 rounded-[26px] p-4">
        <div className="flex items-baseline justify-between">
          <h2 id="weekly-h" className="text-[15px] font-bold">
            Earnings per week
          </h2>
          <p className="text-xs text-ink-2">
            {creatorWeeks[shown].week}: <b className="font-display text-sm font-bold text-ink">{money(creatorWeeks[shown].earned)}</b>
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <div aria-hidden="true" className="flex h-40 flex-col justify-between pb-5 text-right text-[10.5px] text-ink-3">
            <span>{money(top)}</span>
            <span>{money(top / 2)}</span>
            <span>0</span>
          </div>
          <div className="relative flex-1">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-px bg-white/[0.07]" />
              ))}
            </div>
            <ol className="relative flex h-40 items-end justify-around" onPointerLeave={() => setHover(null)}>
              {creatorWeeks.map((w, i) => (
                <li key={w.week} className="flex h-full flex-1 flex-col items-center justify-end">
                  <button
                    type="button"
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${w.week}: ${money(w.earned)}`}
                    className="group relative flex h-[calc(100%-20px)] w-full items-end justify-center"
                  >
                    <span
                      className={`w-full max-w-6 rounded-t-[4px] transition-opacity ${i === creatorWeeks.length - 1 ? "bg-series" : "bg-series/55"} ${hover !== null && hover !== i ? "opacity-60" : ""}`}
                      style={{ height: `${(w.earned / top) * 100}%` }}
                    />
                    {i === creatorWeeks.length - 1 && hover === null && (
                      <span className="absolute -translate-y-1 text-[10.5px] font-semibold text-ink" style={{ bottom: `${(w.earned / top) * 100}%` }}>
                        {money(w.earned)}
                      </span>
                    )}
                  </button>
                  <span className="mt-1.5 h-3.5 text-[10px] whitespace-nowrap text-ink-3">{i % 2 === 1 ? w.week : ""}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <table className="sr-only">
          <caption>Earnings per week</caption>
          <tbody>
            {creatorWeeks.map((w) => (
              <tr key={w.week}>
                <th scope="row">{w.week}</th>
                <td>{money(w.earned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="links-h" className="mt-5">
        <h2 id="links-h" className="mb-3 px-1 text-[15px] font-bold">
          Your links
        </h2>
        <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[26px]">
          {creatorLinks.map((l) => {
            const p = getProduct(l.slug);
            if (!p) return null;
            return (
              <li key={l.slug} className="flex items-center gap-3 px-4 py-3">
                <Image src={p.images[0]} alt="" width={48} height={48} sizes="48px" className="size-12 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.title}</span>
                  <span className="block text-xs text-ink-2">
                    {Math.round(l.commission * 100)}% · {compact(l.clicks)} clicks · {l.orders} orders
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-display text-sm font-bold">{money(l.earned)}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${window.location.origin}/p/${l.slug}?ref=you`);
                        setCopied(l.slug);
                      } catch {
                        // Clipboard blocked.
                      }
                    }}
                    className="text-xs font-semibold text-agent"
                  >
                    {copied === l.slug ? "Copied" : "Copy link"}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="samples-h" className="mt-5">
        <h2 id="samples-h" className="mb-1 px-1 text-[15px] font-bold">
          Free samples for creators
        </h2>
        <p className="mb-3 px-1 text-xs text-ink-2">Factories send these free if you post a video within 14 days.</p>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {sampleOffers.map((slug) => {
            const p = getProduct(slug);
            if (!p) return null;
            const asked = samples.includes(slug);
            return (
              <li key={slug} className="glass-inset overflow-hidden rounded-[22px]">
                <span className="relative block aspect-square">
                  <Image src={p.images[0]} alt="" fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" />
                </span>
                <span className="flex flex-col gap-2 p-3">
                  <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{p.title}</span>
                  <button
                    type="button"
                    onClick={() => setSamples(asked ? samples : [...samples, slug])}
                    className={`h-9 rounded-full text-xs font-bold ${asked ? "bg-positive/15 text-positive" : "bg-white text-black"}`}
                  >
                    {asked ? "Requested" : "Request sample"}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="glass-inset mt-5 flex items-center gap-3 rounded-[22px] p-4 text-[13px] text-ink-2">
        <Icon name="phone" className="size-6 shrink-0 text-positive" />
        <span>
          <b className="font-semibold text-ink">Paid every Friday in USDC to your wallet.</b> No minimum, and no fees in {market.name}.
        </span>
      </p>
    </div>
  );
}
