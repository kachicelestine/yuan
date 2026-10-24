"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { useMoney } from "@/components/price";
import type { Product } from "@/lib/catalog";
import { clock } from "@/lib/format";
import { photo } from "@/lib/images";

export type Deal = { product: Product; dealPrice: number; claimed: number };

/** Seconds until 23:59 Beijing time (15:59 UTC), the fixed daily close. */
function secondsToClose(now: Date) {
  const close = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 59, 0));
  if (close <= now) close.setUTCDate(close.getUTCDate() + 1);
  return Math.floor((close.getTime() - now.getTime()) / 1000);
}

export function NightDeals({ deals }: { deals: Deal[] }) {
  const money = useMoney();
  const { addToCart } = useStore();
  const [left, setLeft] = useState<number | null>(null);
  const [got, setGot] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const tick = () => setLeft(secondsToClose(new Date()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <section aria-labelledby="night-deals">
      <div className="relative overflow-hidden rounded-[32px]">
        <Image src={photo("1735126419093-9cf5c85320a3", { ar: "16:9", fy: 0.35 })} alt="" fill sizes="(min-width: 1024px) 900px, 100vw" className="object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgb(5_5_6/0.3),rgb(5_5_6/0.9))]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-5 pt-24">
          <div>
            <p className="seal text-5xl text-save drop-shadow-[0_4px_18px_rgb(255_197_61/0.45)]" aria-hidden="true">
              夜市
            </p>
            <h2 id="night-deals" className="mt-2 font-display text-[28px] font-extrabold tracking-[-0.02em]">
              Night deals
            </h2>
            <p className="text-sm text-ink-2">Ends 23:59 Beijing time. The clock never resets and stock bars are live.</p>
          </div>
          <div role="timer" aria-label="Time left" className="glass flex h-14 items-center gap-1 rounded-2xl px-4 font-display text-2xl font-extrabold tabular-nums">
            <Icon name="clock" className="mr-1 size-5 text-save" />
            {left === null ? "--:--:--" : clock(left)}
          </div>
        </div>
      </div>

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {deals.map(({ product, dealPrice, claimed }) => {
          const inBag = !!got[product.slug];
          return (
            <li key={product.slug} className="glass flex gap-3 rounded-[26px] p-2.5">
              <Link href={`/p/${product.slug}`} className="relative size-[104px] shrink-0 overflow-hidden rounded-[18px]">
                <Image src={product.images[0]} alt={product.title} fill sizes="104px" className="object-cover" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Link href={`/p/${product.slug}`} className="text-[14.5px] leading-tight font-bold hover:underline">
                  {product.title}
                </Link>
                <span className="flex w-fit items-center gap-1 rounded-full bg-positive/15 px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide text-positive">
                  <Icon name="down" className="size-3" strokeWidth={2.6} />
                  LOWEST IN 30 DAYS
                </span>
                <p className="flex items-baseline gap-1.5">
                  <span className="font-display text-[22px] font-extrabold text-save">{money(dealPrice)}</span>
                  <s className="text-xs text-ink-3">{money(product.price ?? 0)}</s>
                </p>
                <div className="mt-auto flex items-center gap-2.5">
                  <div className="flex-1">
                    <div role="img" aria-label={`${claimed}% claimed`} className="h-2 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-gradient-to-r from-save to-accent" style={{ width: `${claimed}%` }} />
                    </div>
                    <span className="mt-1 block text-[10.5px] text-ink-2">{claimed}% claimed</span>
                  </div>
                  <button
                    type="button"
                    aria-pressed={inBag}
                    onClick={() => {
                      if (!inBag) addToCart({ slug: product.slug, title: product.title, image: product.images[0], unitPrice: dealPrice, qty: 1, note: "NIGHT DEAL" });
                      setGot((g) => ({ ...g, [product.slug]: true }));
                    }}
                    className={`h-11 rounded-full px-4 text-[13.5px] font-extrabold ${inBag ? "bg-positive/15 text-positive" : "bg-save text-black"}`}
                  >
                    {inBag ? "In bag" : "Grab"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

