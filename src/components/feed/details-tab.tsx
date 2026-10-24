"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { brand } from "@/config/brand";
import type { Product, Video } from "@/lib/catalog";

/** Details: what the video says, then everything about the product itself. */
export function DetailsTab({ video, product, onShop }: { video: Video; product: Product; onShop: () => void }) {
  const money = useMoney();
  const cta =
    product.price === undefined
      ? "Get a landed quote"
      : product.options?.length
        ? `Choose options · from ${money(product.price)}`
        : `Buy · ${money(product.price)}`;

  return (
    <div className="flex min-h-full flex-col gap-5 px-4 pt-1">
      <section className="glass-inset rounded-[20px] p-4">
        <h3 className="text-[11px] font-bold tracking-[0.08em] text-ink-3">FROM THE VIDEO</h3>
        <p className="mt-2 text-[15px] leading-relaxed">{video.caption}</p>
        <p className="mt-3 flex flex-wrap items-center gap-1.5">
          {video.tags.map((tag) => (
            <Link key={tag} href={`/discover?q=${tag}`} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
              #{tag}
            </Link>
          ))}
          <span className="flex items-center gap-1 px-1 text-xs font-semibold text-ink-2">
            <Icon name="pin" className="size-3.5" />
            {video.place}
          </span>
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-[15px] font-bold">Highlights</h3>
        <ul className="flex flex-col gap-2 text-[15px]">
          {product.highlights.map((highlight) => (
            <li key={highlight} className="flex items-center gap-2.5">
              <Icon name="check" className="size-[18px] text-positive" />
              {highlight}
            </li>
          ))}
        </ul>
      </section>

      {product.buyersSay && (
        <p className="glass-inset flex gap-3 rounded-[20px] p-4 text-sm leading-relaxed text-ink-2">
          <Icon name="sparkle" className="size-5 text-agent" />
          {product.buyersSay}
        </p>
      )}

      <section>
        <h3 className="mb-1 text-[15px] font-bold">Specs</h3>
        <dl className="flex flex-col divide-y divide-line text-sm">
          {product.specs.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-2">{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Shipping and protection" className="glass-inset flex flex-col gap-3 rounded-[20px] p-4 text-sm">
        <p className="flex gap-3">
          <Icon name="truck" className="size-5 text-ink-2" />
          <span>
            <b className="font-semibold">Arrives {product.delivery}</b>
            <span className="text-ink-2"> · ships from {product.shipsFrom}</span>
          </span>
        </p>
        <p className="flex gap-3">
          <Icon name="globe" className="size-5 text-ink-2" />
          <span className="text-ink-2">Import duties run about {Math.round(product.dutyRate * 100)}%. Pay them at checkout and nothing is due at the door.</span>
        </p>
        <p className="flex gap-3">
          <Icon name="shield" className="size-5 text-positive" />
          <span className="text-ink-2">
            <b className="font-semibold text-ink">{brand.name} Protect</b> holds your payment until it arrives as described.
          </span>
        </p>
      </section>

      <div className="edge-bottom pb-safe sticky bottom-0 -mx-4 mt-auto px-4 pt-5">
        <button
          type="button"
          onClick={onShop}
          className="h-[52px] w-full rounded-full bg-accent text-[15px] font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_20px_rgb(0_0_0/0.3)]"
        >
          {cta}
        </button>
      </div>
    </div>
  );
}

