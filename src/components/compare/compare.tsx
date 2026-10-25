"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AgentOrb } from "@/components/ask/ask-screen";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { useMakePoll } from "@/components/poll/poll-screen";
import { Sheet, type Detent } from "@/components/sheet";
import { useProducts, useSimilar } from "@/components/product/use-products";
import type { Product } from "@/lib/catalog";
import { compareLimit, compareRows, verdict, type CompareRow } from "@/lib/compare";
import { capDensity } from "@/lib/images";
import { useStored } from "@/lib/use-stored";

const presets = [
  { label: "Backup power", slugs: ["power-station-2kwh", "wall-battery-5kwh"] },
  { label: "City rides", slugs: ["e-scooter-city", "e-moto-fat-tyre"] },
  { label: "Export EVs", slugs: ["ev-sedan-export", "ev-suv-export"] },
  { label: "Serums", slugs: ["serum-niacinamide", "serum-bakuchiol"] },
  { label: "Shoulder bags", slugs: ["bag-red-shoulder", "bag-structured-top-handle", "bag-sling-tech"] },
];

/** The shopper's compare list, newest last, capped at three. */
export function useCompare() {
  const [slugs, setSlugs] = useStored<string[]>("app.compare", []);
  const toggle = (slug: string) => setSlugs(slugs.includes(slug) ? slugs.filter((s) => s !== slug) : [...slugs, slug].slice(-compareLimit));
  return { slugs, setSlugs, toggle };
}

/** Round header button on the product page; a toast offers the comparison once there are two. */
export function CompareButton({ product, className = "" }: { product: Product; className?: string }) {
  const { slugs, toggle } = useCompare();
  const [toast, setToast] = useState(false);
  const on = slugs.includes(product.slug);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? "Remove from compare" : "Add to compare"}
        onClick={() => {
          toggle(product.slug);
          setToast(!on);
        }}
        className={`${className} relative ${on ? "text-series" : ""}`}
      >
        <Icon name="compare" className="size-5" />
        {slugs.length > 0 && <span className="absolute -top-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-series text-[10px] font-bold text-white">{slugs.length}</span>}
      </button>
      {toast &&
        createPortal(
          <div role="status" className="pt-safe pointer-events-none fixed inset-x-0 top-[68px] z-50 flex justify-center px-4 lg:top-[84px]">
            <Link href="/compare" className="glass glass-prominent pointer-events-auto flex h-12 motion-safe:animate-rise items-center gap-2.5 rounded-full pr-2 pl-4 text-sm font-semibold">
              <Icon name="compare" className="size-4 text-series" />
              {slugs.length < 2 ? "Added. Pick one more to compare" : `Comparing ${slugs.length}`}
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">Open</span>
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Up to three products side by side, the winner of each row marked, and an overall pick. */
export function CompareScreen() {
  const money = useMoney();
  const { market } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const { slugs: stored, setSlugs, toggle } = useCompare();
  const [diffOnly, setDiffOnly] = useState(false);
  const [picker, setPicker] = useState<Detent>("closed");
  const makePoll = useMakePoll();
  const shared = params.get("ids")?.split(",").filter((s) => /^[a-z0-9-]{1,80}$/.test(s));
  const slugs = shared?.length ? shared.slice(0, compareLimit) : stored;
  // Listings from the catalog; any that were taken down drop out.
  const items = useProducts(slugs).products;
  const rows = compareRows(items, market, money);
  const pick = verdict(items, rows);
  const groups = [...new Set(rows.map((r) => r.group))];
  const differs = (r: CompareRow) => new Set(r.cells.map((c) => c.text)).size > 1;
  const cols = items.length < compareLimit && items.length > 0 ? items.length + 1 : items.length;
  const grid = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  const candidates = useSimilar(items[0]?.slug ?? null).filter((p) => !slugs.includes(p.slug));

  const sharedKey = shared?.join() ?? "";

  // A shared link becomes your own list, so edits from here behave like your own.
  useEffect(() => {
    if (!sharedKey) return;
    setSlugs(sharedKey.split(",").slice(0, compareLimit));
    router.replace("/compare", { scroll: false });
  }, [sharedKey, setSlugs, router]);

  return (
    <div className="mx-auto max-w-[1000px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.03em]">Compare</h1>
          <p className="text-xs text-ink-2">Prices delivered to {market.city}, duties and {market.vatLabel} included</p>
        </div>
        {items.length > 0 && (
          <button type="button" onClick={() => setSlugs([])} className="glass-inset h-9 rounded-full px-3.5 text-[13px] font-semibold text-ink-2">
            Clear
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <section aria-label="Start a comparison" className="glass flex flex-col items-center gap-4 rounded-[30px] px-5 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-[22px] bg-series/15 text-series">
            <Icon name="compare" className="size-8" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">Nothing to compare yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">Tap the compare button on any product, or start with one of these.</p>
          </div>
          <ul className="flex flex-wrap justify-center gap-2">
            {presets.map((p) => (
              <li key={p.label}>
                <button type="button" onClick={() => setSlugs(p.slugs)} className="glass-inset h-10 rounded-full px-4 text-sm font-semibold">
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <div className="sticky top-0 z-20 -mx-3.5 border-b border-line bg-canvas/75 px-3.5 pt-safe pb-3 backdrop-blur-2xl lg:-mx-6 lg:px-6 lg:pt-3">
            <ul className="grid gap-2" style={grid}>
              {items.map((p) => (
                <li key={p.slug} className="relative">
                  <Link href={`/p/${p.slug}`} className="block">
                    <span className="relative block aspect-square overflow-hidden rounded-[18px] bg-surface lg:aspect-[4/3]">
                      <Image src={p.images[0]} alt="" fill sizes={capDensity("(min-width: 1000px) 300px, 33vw")} className="object-cover" />
                    </span>
                    <span className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug font-semibold">{p.title}</span>
                  </Link>
                  <button type="button" aria-label={`Remove ${p.title}`} onClick={() => toggle(p.slug)} className="glass absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full">
                    <Icon name="close" className="size-4" />
                  </button>
                </li>
              ))}
              {items.length < compareLimit && (
                <li>
                  <button type="button" onClick={() => setPicker("half")} className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-[18px] border border-dashed border-white/25 text-[12.5px] font-semibold text-ink-2 lg:aspect-[4/3]">
                    <Icon name="plus" className="size-6" />
                    Add a product
                  </button>
                </li>
              )}
            </ul>
          </div>

          {pick && (
            <section aria-label="Our pick" className="glass mt-4 flex items-start gap-3 rounded-[26px] p-4">
              <AgentOrb className="size-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink-2">
                  Wins {pick.wins} of {pick.of} rows
                </p>
                <h2 className="text-[15px] font-bold">Best overall: {pick.product.title}</h2>
                {pick.reasons.length > 0 && <p className="text-[13px] text-ink-2">Strongest on {pick.reasons.join(", ")}.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/p/${pick.product.slug}`} className="flex h-10 items-center rounded-full bg-white px-4 text-[13px] font-bold text-black">
                    View the pick
                  </Link>
                  <Link
                    href={`/ask?q=${encodeURIComponent(`Compare ${items.map((p) => p.title).join(" vs ")}`)}`}
                    className="glass-inset flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold"
                  >
                    <Icon name="sparkle" className="size-4 text-agent" />
                    Ask which suits me
                  </Link>
                  <button type="button" onClick={() => makePoll(items.map((p) => p.slug))} className="glass-inset flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
                    <Icon name="poll" className="size-4 text-series" />
                    Ask friends
                  </button>
                </div>
              </div>
            </section>
          )}

          {items.length > 1 && (
            <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 px-1">
              <span className="text-sm font-semibold">Only show differences</span>
              <input type="checkbox" role="switch" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} className="peer sr-only" />
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-white/20 transition-colors peer-checked:bg-series peer-focus-visible:ring-2 peer-focus-visible:ring-white">
                <span className={`absolute top-1 left-1 size-5 rounded-full bg-white transition-transform duration-500 ease-spring ${diffOnly ? "translate-x-5" : ""}`} />
              </span>
            </label>
          )}

          {groups.map((g) => {
            const shown = rows.filter((r) => r.group === g && (!diffOnly || differs(r)));
            if (!shown.length) return null;
            return (
              <section key={g} aria-labelledby={`cmp-${g}`} className="mt-5">
                <h2 id={`cmp-${g}`} className="mb-2 px-1 text-[13px] font-bold tracking-[0.08em] text-ink-3 uppercase">
                  {g}
                </h2>
                <dl className="glass flex flex-col divide-y divide-line rounded-[24px] px-3">
                  {shown.map((r) => (
                    <div key={r.label} className="py-2.5">
                      <dt className="mb-1 text-[11.5px] font-semibold text-ink-3">{r.label}</dt>
                      <dd className="grid gap-2" style={grid}>
                        {r.cells.map((c, i) => (
                          <span key={i} className={`rounded-xl px-2 py-1.5 text-[13px] leading-snug break-words ${r.best === i ? "bg-positive/12 font-semibold ring-1 ring-positive/30" : ""}`}>
                            {c.text}
                            {r.best === i && (
                              <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-bold text-positive">
                                <Icon name="check" className="size-3" />
                                {r.lowerWins ? (g === "Delivery" && r.label === "Arrives" ? "Fastest" : "Lowest") : "Best"}
                              </span>
                            )}
                          </span>
                        ))}
                        {cols > items.length && <span />}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </>
      )}

      <Sheet detent={picker} onDetent={setPicker} label="Add a product to compare">
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex shrink-0 touch-none items-center gap-3 px-4 pt-1 pb-3">
            <h2 className="flex-1 font-display text-[22px] font-bold">Add to compare</h2>
            <button type="button" onClick={() => setPicker("closed")} aria-label="Close" className="glass-inset grid size-9 place-items-center rounded-full">
              <Icon name="close" className="size-[18px]" />
            </button>
          </header>
          <ul data-sheet-scroll className="pb-safe flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4">
            {candidates.length === 0 && <li className="py-6 text-center text-sm text-ink-2">Nothing else in this category yet. Search for a product and tap compare there.</li>}
            {candidates.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => {
                    toggle(p.slug);
                    setPicker("closed");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-white/5"
                >
                  <Image src={p.images[0]} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-ink-2">
                      {p.price === undefined ? "Quote" : money(p.price)} · ★ {p.rating}
                    </span>
                  </span>
                  <Icon name="plus" className="size-5 text-ink-2" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}
