"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { ShipTo } from "@/components/market/ship-to";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { SellerCouponChip } from "@/components/rewards/coupon-wallet";
import { Sheet, type Detent } from "@/components/sheet";
import { brand } from "@/config/brand";
import { unitPrice, type Product } from "@/lib/catalog";
import { landedCost, shiftDelivery } from "@/lib/landed";

type Props = {
  product: Product;
  /** "page" pins the actions to the bottom of the screen on phones; "panel" pins them to the bottom of the scrolling panel it sits in. */
  variant?: "page" | "panel";
};

const noSubscribe = () => () => {};

// Only listings sold by quote need the request form, and only once the sheet opens.
const RfqForm = dynamic(() => import("@/components/business/rfq-form").then((m) => m.RfqForm), { loading: () => <div className="skeleton mt-3 h-80 rounded-[22px]" /> });

export function BuyBox({ product, variant = "page" }: Props) {
  const router = useRouter();
  const onClient = useSyncExternalStore(noSubscribe, () => true, () => false);
  const { addToCart, market, account, alerts, toggleAlert } = useStore();
  const money = useMoney();
  const options = product.options ?? [];
  // Start on a value that's in stock when the default one isn't.
  const [choices, setChoices] = useState(() =>
    options.map((o) => {
      const d = o.defaultIndex ?? 0;
      if (!o.values[d]?.soldOut) return d;
      const free = o.values.findIndex((v) => !v.soldOut);
      return free === -1 ? d : free;
    }),
  );
  const [qty, setQty] = useState(product.moq ?? 1);
  // Stock, when the shop counts it: undefined means made to order (no limit shown).
  const stock = product.stock;
  const pickedSoldOut = options.some((o, i) => o.values[choices[i]]?.soldOut);
  const soldOut = stock === 0 || pickedSoldOut;
  const maxQty = stock === undefined ? 999 : Math.max(stock, 1);
  const waiting = alerts.includes(product.slug);
  const [dutiesNow, setDutiesNow] = useState(true);
  const [added, setAdded] = useState(false);
  // Listings sold by quote: the request sheet, and the request once sent.
  const [quoteSheet, setQuoteSheet] = useState<Detent>("closed");
  const [quoted, setQuoted] = useState<string | null>(null);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(t);
  }, [added]);

  const delta = options.reduce((sum, option, i) => sum + (option.values[choices[i]]?.delta ?? 0), 0);
  const unit = unitPrice(product, qty, delta);
  const listUnit = unitPrice(product, 1, delta);
  const landed = landedCost(unit * qty, product.dutyRate, market);
  const taxes = landed.duty + landed.vat;
  const total = landed.item + landed.shipping + (dutiesNow ? taxes : 0);
  const taxName = market.vat ? `duties and ${market.vatLabel}` : "duties";
  const saving = (listUnit - unit) * qty;
  const optionLabel = options.map((o, i) => o.values[choices[i]]?.label).join(" · ");
  const quoteOnly = product.price === undefined;

  function add() {
    addToCart({
      slug: product.slug,
      title: product.title,
      image: product.images[0],
      option: optionLabel || undefined,
      unitPrice: unit,
      qty,
    });
    setAdded(true);
  }

  const actions = soldOut && !quoteOnly ? (
    <button
      type="button"
      aria-pressed={waiting}
      onClick={() => toggleAlert(product.slug)}
      className={`h-[52px] flex-1 rounded-full text-[15px] font-bold ${waiting ? "glass-inset text-positive" : "bg-white text-black"}`}
    >
      {waiting ? "We'll tell you when it's back" : pickedSoldOut && stock !== 0 ? "This one's sold out · tell me when it's back" : "Sold out · tell me when it's back"}
    </button>
  ) : quoteOnly ? (
    quoted ? (
      <Link href={`/business#rfq-${quoted}`} className="grid h-[52px] flex-1 place-items-center rounded-full bg-white/15 text-[15px] font-bold">
        Request sent · see quotes
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => setQuoteSheet("full")}
        className="h-[52px] flex-1 rounded-full bg-accent text-[15px] font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
      >
        Request a quote
      </button>
    )
  ) : (
    <>
      <button type="button" onClick={add} className="glass-inset h-[52px] flex-1 rounded-full text-[15px] font-semibold" aria-live="polite">
        {added ? "Added to bag" : "Add to bag"}
      </button>
      <button
        type="button"
        onClick={() => {
          add();
          router.push("/checkout");
        }}
        className="h-[52px] flex-[1.4] rounded-full bg-accent text-[15px] font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_20px_rgb(0_0_0/0.3)]"
      >
        Buy now · {money(total)}
      </button>
    </>
  );

  return (
    <div className={`flex flex-col gap-4 ${variant === "panel" ? "flex-1" : ""}`}>
      {!quoteOnly && (
        <div className="glass-inset rounded-[22px] p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[34px] leading-none font-extrabold tracking-[-0.03em]">{money(unit)}</span>
            <span className="text-[13px] text-ink-2">{product.tiers ? "per unit" : product.was ? <s>{money(product.was + delta)}</s> : null}</span>
            {saving > 0 ? (
              <span className="ml-auto text-xs font-semibold text-positive">You save {money(saving)}</span>
            ) : product.tiers ? (
              <span className="ml-auto text-xs font-semibold text-positive">
                Buy {product.tiers[1].min}+ for {money(product.tiers[1].price + delta)}
              </span>
            ) : null}
          </div>
          {product.tiers && (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {product.tiers.map((tier, i) => {
                const next = product.tiers?.[i + 1];
                const on = qty >= tier.min && (!next || qty < next.min);
                return (
                  <div
                    key={tier.min}
                    className={`rounded-[14px] px-2.5 py-2 transition-colors ${on ? "bg-white/15 shadow-[inset_0_0_0_1.25px_rgb(255_255_255/0.8)]" : "bg-white/5 shadow-[inset_0_0_0_0.75px_rgb(255_255_255/0.12)]"}`}
                  >
                    <span className="block text-[11px] font-semibold tracking-wide text-ink-2">
                      {next ? `${tier.min}–${next.min - 1}` : `${tier.min}+`} PCS
                    </span>
                    <span className="font-display text-base font-bold">{money(tier.price + delta)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <SellerCouponChip sellerId={product.sellerId} />

      {options.map((option, oi) => {
        const swatches = option.values.every((v) => v.swatch);
        return (
          <fieldset key={option.name} className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">
              {option.name} · <span className="text-ink">{option.values[choices[oi]]?.label}</span>
            </legend>
            <div className={swatches ? "flex gap-1.5" : "flex flex-wrap gap-2"}>
              {option.values.map((value, vi) => {
                const on = choices[oi] === vi;
                const out = !!value.soldOut;
                const pick = () => setChoices((c) => c.map((x, i) => (i === oi ? vi : x)));
                return swatches ? (
                  <button
                    key={value.label}
                    type="button"
                    aria-label={out ? `${value.label} (sold out)` : value.label}
                    aria-pressed={on}
                    onClick={pick}
                    className={`grid size-11 place-items-center rounded-full transition-shadow ${on ? "shadow-[inset_0_0_0_2px_#fff]" : ""} ${out ? "opacity-40" : ""}`}
                  >
                    <span className="size-[30px] rounded-full shadow-[inset_0_1px_1px_rgb(255_255_255/0.4),inset_0_-2px_4px_rgb(0_0_0/0.25)]" style={{ background: value.swatch }} />
                  </button>
                ) : (
                  <button
                    key={value.label}
                    type="button"
                    aria-pressed={on}
                    onClick={pick}
                    className={`flex min-h-11 min-w-16 flex-col items-center justify-center rounded-2xl px-3.5 py-2 transition-[background,box-shadow] ${on ? "bg-white/20 shadow-[inset_0_0_0_1.5px_#fff]" : "glass-inset"} ${out ? "opacity-50" : ""}`}
                  >
                    <span className={`text-sm font-semibold ${out ? "line-through" : ""}`}>{value.label}</span>
                    {out ? <span className="text-[11px] text-like">Sold out</span> : value.sub && <span className="text-[11px] text-ink-2">{value.sub}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {!quoteOnly && !soldOut && (
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-ink-2">
            Quantity
            {stock !== undefined && stock <= 10 && <span className="ml-2 rounded-full bg-like/15 px-2 py-0.5 text-[11px] font-bold text-like">Only {stock} left</span>}
          </span>
          <div className="glass flex h-12 items-center rounded-full p-0.5">
            <button type="button" aria-label="Decrease quantity" disabled={qty <= (product.moq ?? 1)} onClick={() => setQty((q) => q - 1)} className="grid size-11 place-items-center rounded-full disabled:opacity-35">
              <Icon name="minus" className="size-5" />
            </button>
            <output aria-live="polite" className="min-w-10 text-center font-display text-lg font-bold">
              {qty}
            </output>
            <button type="button" aria-label="Increase quantity" disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="grid size-11 place-items-center rounded-full disabled:opacity-35">
              <Icon name="plus" className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="glass-inset flex flex-col gap-3 rounded-[22px] p-4 text-sm">
        <p className="flex items-center gap-3">
          <Icon name="truck" className="size-5 text-ink-2" />
          <span className="flex-1">
            <b className="font-semibold">Arrives {shiftDelivery(product.delivery, market.extraDays)}</b>
            <span className="text-ink-2">
              {" "}
              · {product.shipsFrom} to <Flag code={market.code} className="-mt-0.5 size-4 align-middle" /> {market.city}
            </span>
          </span>
          <ShipTo variant="link" className="shrink-0 text-[13px]" />
        </p>
        {!quoteOnly && (
          <label className="flex cursor-pointer items-center gap-3">
            <span className="relative inline-flex">
              <input type="checkbox" role="switch" checked={dutiesNow} onChange={(e) => setDutiesNow(e.target.checked)} className="peer sr-only" />
              <span className="h-8 w-[52px] rounded-full bg-white/20 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-white" />
              <span className="absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-500 ease-spring peer-checked:translate-x-5" />
            </span>
            <span className="text-ink-2">
              {dutiesNow ? (
                <>
                  <b className="font-semibold text-ink">{taxName[0].toUpperCase() + taxName.slice(1)} paid now</b> ({money(taxes)}). Nothing to pay at the door.
                </>
              ) : (
                <>
                  Pay about {money(taxes)} in {taxName} when it arrives.
                </>
              )}
            </span>
          </label>
        )}
        {!quoteOnly && (
          <details className="group -mx-1 rounded-2xl px-1">
            <summary className="flex cursor-pointer list-none items-center gap-3 text-ink-2 [&::-webkit-details-marker]:hidden">
              <Icon name="globe" className="size-5" />
              <span className="flex-1">
                Landed price in {market.name} <b className="font-semibold text-ink">{money(landed.total)}</b>
              </span>
              <Icon name="down" className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="mt-2.5 ml-8 flex flex-col gap-1 text-[13px] text-ink-2">
              <div className="flex justify-between">
                <dt>Item{qty > 1 ? ` × ${qty}` : ""}</dt>
                <dd className="text-ink">{money(landed.item)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd className="text-ink">{landed.shipping ? money(landed.shipping) : `Free over ${money(market.freeShippingOver)}`}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Import duty ({Math.round(product.dutyRate * 1000) / 10}%)</dt>
                <dd className="text-ink">{money(landed.duty)}</dd>
              </div>
              {market.vat > 0 && (
                <div className="flex justify-between">
                  <dt>
                    {market.vatLabel} ({Math.round(market.vat * 1000) / 10}%)
                  </dt>
                  <dd className="text-ink">{money(landed.vat)}</dd>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-line pt-1.5 font-semibold text-ink">
                <dt>At your door</dt>
                <dd>{money(landed.total)}</dd>
              </div>
            </dl>
          </details>
        )}
        <p className="flex items-center gap-3">
          <Icon name="shield" className="size-5 text-positive" />
          <span className="text-ink-2">
            <b className="font-semibold text-ink">{brand.name} Protect</b> holds your payment until it arrives as described.
          </span>
        </p>
      </div>

      {variant === "page" ? (
        <>
          <div className="hidden gap-2 lg:flex">{actions}</div>
          {/* On phones the actions float above everything. Portalled, because the glass sheet's
              backdrop-filter would otherwise become the containing block for position: fixed. */}
          {onClient &&
            createPortal(<div className="glass bottom-safe fixed inset-x-3 z-40 flex gap-2 rounded-full p-2 lg:hidden">{actions}</div>, document.body)}
        </>
      ) : (
        <div className="edge-bottom pb-safe sticky bottom-0 -mx-4 mt-auto flex gap-2 px-4 pt-5">{actions}</div>
      )}
      {quoteOnly && (
        <Sheet detent={quoteSheet} onDetent={setQuoteSheet} label={`Request a quote for ${product.title}`}>
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 touch-none items-center gap-3 px-4 pt-1 pb-1">
              <h2 className="flex-1 font-display text-[22px] font-bold">Request a quote</h2>
              <button type="button" onClick={() => setQuoteSheet("closed")} aria-label="Close" className="glass-inset grid size-9 place-items-center rounded-full">
                <Icon name="close" className="size-[18px]" />
              </button>
            </header>
            <div data-sheet-scroll className="pb-safe min-h-0 flex-1 overflow-y-auto px-4">
              <p className="text-[13px] text-ink-2">{product.title}. The shop quotes a price per unit for your quantity; if you accept, it&apos;s held for you for 7 days.</p>
              <RfqForm
                signedIn={!!account}
                next={`/p/${product.slug}`}
                slug={product.slug}
                item={product.title}
                onSent={(r) => {
                  setQuoted(r.id);
                  setQuoteSheet("closed");
                }}
              />
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

