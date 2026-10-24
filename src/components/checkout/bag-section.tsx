"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { ProductCard } from "@/components/product/product-card";
import { couponHeadline } from "@/components/rewards/coupon-wallet";
import type { CartLine } from "@/components/providers";
import type { Coupon, Product } from "@/lib/catalog";

export type BagGroup = { origin: string; sellers: string[]; lines: CartLine[] };

type Props = {
  groups: BagGroup[];
  count: number;
  subtotal: number;
  freeOver: number;
  combine: boolean;
  onCombine: (on: boolean) => void;
  combineSaving: number;
  onQty: (key: string, qty: number) => void;
  onLater: (line: CartLine) => void;
  coupon: { coupon: Coupon; discount: number } | null;
  later: CartLine[];
  onMoveBack: (line: CartLine) => void;
  pairs: Product[];
};

/** Bag 2.0: grouped by where each item ships from, with one-box consolidation, coupons and save for later. */
export function BagSection({ groups, count, subtotal, freeOver, combine, onCombine, combineSaving, onQty, onLater, coupon, later, onMoveBack, pairs }: Props) {
  const money = useMoney();
  const gap = Math.max(0, freeOver - subtotal);

  return (
    <>
      <section aria-label="Your bag" className="glass rounded-[26px] p-4">
        <h2 className="text-[13px] font-semibold text-ink-2">Your bag · {count} {count === 1 ? "item" : "items"}</h2>
        <div className="mt-2.5 mb-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-positive/70 to-positive transition-[width] duration-700" style={{ width: `${Math.min(1, subtotal / freeOver) * 100}%` }} />
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-2">
            {gap > 0 ? (
              <>
                Add <b className="font-semibold text-ink">{money(gap)}</b> more for free standard shipping
              </>
            ) : (
              <>
                <Icon name="check" className="size-3.5 text-positive" />
                Free standard shipping unlocked
              </>
            )}
          </p>
        </div>

        {groups.map((g) => (
          <div key={g.origin} className="mt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
              <Icon name="factory" className="size-3.5" />
              Ships from {g.origin} · {g.sellers.join(", ")}
            </p>
            <ul className="mt-1 flex flex-col divide-y divide-line">
              {g.lines.map((line) => (
                <li key={line.key} className="flex items-center gap-3 py-3">
                  <Image src={line.image} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-[14px] object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{line.title}</p>
                    <p className="text-xs text-ink-2">{line.option ?? "Standard"}</p>
                    {line.note && <p className="mt-1 inline-flex rounded-full bg-accent-light/20 px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-accent-light">{line.note}</p>}
                    <button type="button" onClick={() => onLater(line)} className="mt-1 block text-xs font-semibold text-ink-3 hover:text-ink">
                      Save for later
                    </button>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="font-display font-bold">{money(line.unitPrice * line.qty)}</span>
                    <div className="glass-inset flex h-9 items-center rounded-full">
                      <button type="button" aria-label={`Remove one ${line.title}`} onClick={() => onQty(line.key, line.qty - 1)} className="grid size-9 place-items-center">
                        <Icon name={line.qty === 1 ? "close" : "minus"} className="size-4" />
                      </button>
                      <span className="min-w-5 text-center text-sm font-semibold">{line.qty}</span>
                      <button type="button" aria-label={`Add one ${line.title}`} onClick={() => onQty(line.key, line.qty + 1)} className="grid size-9 place-items-center">
                        <Icon name="plus" className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {groups.length > 1 && (
          <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-[20px] bg-series/10 p-3 ring-1 ring-series/25">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-series/20 text-series">
              <Icon name="bag" className="size-5" />
            </span>
            <span className="flex-1 text-[13px] text-ink-2">
              <b className="block text-sm font-semibold text-ink">Combine into one box</b>
              Our Guangzhou hub repacks {groups.length} parcels so everything arrives together{combineSaving > 0 ? `, saving ${money(combineSaving)}` : ""}.
            </span>
            <input type="checkbox" role="switch" checked={combine} onChange={(e) => onCombine(e.target.checked)} className="peer sr-only" />
            <span className="relative h-7 w-12 shrink-0 rounded-full bg-white/20 transition-colors peer-checked:bg-series peer-focus-visible:ring-2 peer-focus-visible:ring-white">
              <span className={`absolute top-1 left-1 size-5 rounded-full bg-white transition-transform duration-500 ease-spring ${combine ? "translate-x-5" : ""}`} />
            </span>
          </label>
        )}
      </section>

      <Link href="/coupons" className="glass flex items-center gap-3 rounded-[22px] p-3.5">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${coupon ? "bg-accent text-white" : "bg-white/10 text-ink-2"}`}>
          <Icon name="card" className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          {coupon ? (
            <>
              <b className="block font-semibold">
                {couponHeadline(coupon.coupon, money)} applied · −{money(coupon.discount)}
              </b>
              <span className="text-xs text-ink-2">The best coupon in your wallet. Tap to see others.</span>
            </>
          ) : (
            <>
              <b className="block font-semibold">No coupon yet</b>
              <span className="text-xs text-ink-2">Claim free coupons or swap coins for one.</span>
            </>
          )}
        </span>
        <Icon name="forward" className="size-4 text-ink-3" />
      </Link>

      {later.length > 0 && (
        <section aria-label="Saved for later" className="glass-inset rounded-[22px] p-3.5">
          <h2 className="mb-2 text-[13px] font-semibold text-ink-2">Saved for later</h2>
          <ul className="flex flex-col gap-2">
            {later.map((line) => (
              <li key={line.key} className="flex items-center gap-3">
                <Image src={line.image} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-xl object-cover" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{line.title}</span>
                <button type="button" onClick={() => onMoveBack(line)} className="h-8 shrink-0 rounded-full bg-white px-3 text-xs font-bold text-black">
                  Move to bag
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pairs.length > 0 && (
        <section aria-label="Goes well with">
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Goes well with your bag</h2>
          <ul className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-3.5">
            {pairs.map((p) => (
              <li key={p.slug} className="w-[150px] shrink-0">
                <ProductCard product={p} sizes="150px" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
