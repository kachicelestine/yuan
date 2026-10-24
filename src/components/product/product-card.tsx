"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { getSeller, type Product } from "@/lib/catalog";
import { compact } from "@/lib/format";

/** A product in a results grid: photo with deal badges, price, rating, sold count and seller. */
export function ProductCard({ product, sizes, eager, badge }: { product: Product; sizes: string; eager?: boolean; badge?: string }) {
  const money = useMoney();
  // Database-backed products carry their seller; fixture products are looked up.
  const seller = product.seller ?? getSeller(product.sellerId);
  const off = product.price && product.was ? Math.round((1 - product.price / product.was) * 100) : 0;
  const bulk = product.tiers?.at(-1);

  return (
    <Link href={`/p/${product.slug}`} className="group glass-inset flex h-full flex-col overflow-hidden rounded-[22px]">
      <span className="relative block aspect-square overflow-hidden">
        <Image src={product.images[0]} alt="" fill loading={eager ? "eager" : undefined} sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        {(badge || off > 0) && (
          <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
            {badge ?? `−${off}%`}
          </span>
        )}
        {bulk && (
          <span data-tone="light" className="absolute bottom-2 left-2">
            <span className="glass flex h-6 items-center rounded-full px-2 text-[10.5px] font-bold">
              {bulk.min}+ at {money(bulk.price)}
            </span>
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1 px-3 pt-2.5 pb-3">
        <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{product.title}</span>
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <b className="font-display text-lg font-extrabold tracking-[-0.01em]">{product.price ? money(product.price) : "Quote"}</b>
          {product.was && <s className="text-xs text-ink-3">{money(product.was)}</s>}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-ink-2">
          <Icon name="star" filled className="size-3 text-save" />
          {product.rating} · {product.sold ? `${compact(product.sold)} sold` : `${compact(product.reviews)} reviews`}
        </span>
        {seller && (
          <span className="mt-auto flex items-center gap-1 pt-0.5 text-[11px] text-ink-3">
            {seller.kind === "Factory" && <Icon name="factory" className="size-3" />}
            <span className="truncate">{seller.name}</span>
          </span>
        )}
      </span>
    </Link>
  );
}

