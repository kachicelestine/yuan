"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";

export function BagButton() {
  const { cartCount } = useStore();
  return (
    <Link href="/checkout" data-bag aria-label={`Bag, ${cartCount} items`} className="glass glass-prominent grid size-11 place-items-center rounded-full">
      <Icon name="bag" className="size-5" />
      {cartCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold text-black">
          {cartCount}
        </span>
      )}
    </Link>
  );
}

