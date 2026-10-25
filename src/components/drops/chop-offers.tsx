"use client";

import Image from "next/image";
import { useStartChop } from "@/components/chop/chop-screen";
import { Icon } from "@/components/icon";
import { Price } from "@/components/price";
import type { ChopOfferView } from "@/modules/engagement";

type Item = { offer: ChopOfferView; product: { title: string; image: string } };

/** Chops shops are offering: start one and send it to friends. */
export function ChopOffers({ items }: { items: Item[] }) {
  const { start, busy, error } = useStartChop();
  if (!items.length) return <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No chops on offer right now. Shops add new ones every week.</p>;
  return (
    <>
      {error && (
        <p role="alert" className="mb-2 text-xs font-semibold text-like">
          {error}
        </p>
      )}
      <ul className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-3.5 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
        {items.map(({ offer: o, product }) => (
          <li key={o.id} className="w-[260px] shrink-0 lg:w-auto">
            <button type="button" disabled={busy} onClick={() => start(o.id)} className="glass flex h-full w-full flex-col gap-3 rounded-[26px] p-3 text-left">
              <span className="flex items-center gap-3">
                <Image src={product.image} alt="" width={64} height={64} sizes="64px" className="size-16 shrink-0 rounded-2xl object-cover" />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm leading-snug font-semibold">{product.title}</span>
                  <span className="mt-0.5 flex items-baseline gap-1.5">
                    <Price usd={o.fullPrice} className="font-display text-lg font-extrabold" />
                    <span className="text-xs text-ink-2">
                      → <Price usd={o.target} className="font-bold text-save" />
                    </span>
                  </span>
                </span>
              </span>
              <span className="flex gap-0.5" aria-hidden="true">
                {Array.from({ length: o.cuts }, (_, i) => (
                  <span key={i} className="h-1.5 flex-1 rounded-full bg-white/12" />
                ))}
              </span>
              <span className="flex items-center gap-2 text-xs text-ink-2">
                {o.cuts} cuts · {o.hours} h
                {o.remaining <= 10 && <span className="text-save"> · {o.remaining} left</span>}
                <span className="ml-auto flex h-8 items-center gap-1 rounded-full bg-accent px-3 font-bold text-white">
                  <Icon name="scissors" className="size-3.5" />
                  Start
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
