"use client";

import Image from "next/image";
import { useRef } from "react";
import type { Product } from "@/lib/catalog";
import { useMoney } from "@/components/price";

/**
 * The shop sheet at rest: the product in the video, docked beside the minimized tab bar
 * like an iOS 26/27 bottom accessory. Tap it or swipe it up to open the sheet.
 */
export function ProductPeek({ product, look = [], onOpen, className = "" }: { product: Product; look?: Product[]; onOpen: () => void; className?: string }) {
  const money = useMoney();
  const startY = useRef<number | null>(null);
  const quoteOnly = product.price === undefined;
  const off = product.price && product.was ? Math.round((1 - product.price / product.was) * 100) : 0;

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`${product.title}, ${quoteOnly ? "landed quote" : money(product.price ?? 0)}. Open the shop sheet`}
      onClick={onOpen}
      onPointerDown={(event) => {
        startY.current = event.clientY;
      }}
      onPointerUp={(event) => {
        if (startY.current !== null && startY.current - event.clientY > 24) onOpen();
        startY.current = null;
      }}
      className={`glass glass-bar flex h-[52px] touch-none items-center gap-2 rounded-full p-1.5 text-left ${className}`}
    >
      {/* The product is already on screen in the video, so the price leads and the title follows. */}
      <span key={product.slug} className="flex min-w-0 flex-1 items-center gap-2.5 motion-safe:animate-rise">
        {look.length > 1 ? (
          <span className="relative size-10 shrink-0">
            <Image src={product.images[0]} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-full object-cover" />
            <Image src={look[1].images[0]} alt="" width={22} height={22} sizes="22px" className="absolute -right-1 -bottom-1 size-[22px] rounded-full object-cover ring-2 ring-black/40" />
          </span>
        ) : (
          <Image src={product.images[0]} alt="" width={40} height={40} sizes="40px" className="size-10 shrink-0 rounded-full object-cover" />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-display text-base leading-tight font-bold">{quoteOnly ? "Landed quote" : money(product.price ?? 0)}</span>
            {off > 0 && <span className="rounded-full bg-accent-light/20 px-1.5 text-[11px] leading-[18px] font-bold text-accent-light">−{off}%</span>}
          </span>
          <span className="truncate text-xs leading-tight text-ink-2">{look.length > 1 ? `Shop the look · ${look.length} items` : product.title}</span>
        </span>
      </span>
      <span className="flex h-10 shrink-0 items-center rounded-full bg-accent px-3.5 text-sm font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_16px_rgb(0_0_0/0.25)]">
        {quoteOnly ? "Quote" : "Buy"}
      </span>
    </button>
  );
}

