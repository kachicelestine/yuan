"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { capDensity } from "@/lib/images";
import { useMoney } from "@/components/price";

/** A square product card: photo, two-line title and price. */
export function ProductTile({ product, sizes }: { product: Product; sizes: string }) {
  const money = useMoney();
  return (
    <Link href={`/p/${product.slug}`} className="glass-inset block overflow-hidden rounded-[22px]">
      <span className="relative block aspect-square">
        <Image src={product.images[0]} alt="" fill sizes={capDensity(sizes)} className="object-cover" />
      </span>
      <span className="block px-3 pt-2.5 pb-3">
        <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{product.title}</span>
        <span className="mt-1 block font-display text-lg font-extrabold">{product.price ? money(product.price) : "Quote"}</span>
      </span>
    </Link>
  );
}

