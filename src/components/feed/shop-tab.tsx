"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { useMoney } from "@/components/price";
import { BuyBox } from "@/components/product/buy-box";
import { useStore } from "@/components/providers";
import { unitPrice, type Product } from "@/lib/catalog";

type Props = { product: Product; look: Product[]; onFocus: (slug: string) => void; onAsk: () => void };

/** Shop: every operation on the product, from saving it for later to checking out. */
export function ShopTab({ product, look, onFocus, onAsk }: Props) {
  const { saved, toggleSaved, alerts, toggleAlert } = useStore();
  const isSaved = saved.includes(product.slug);
  const alertOn = alerts.includes(product.slug);

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-1">
      {look.length > 1 && <LookStrip look={look} selected={product.slug} onSelect={onFocus} />}
      <div className="grid grid-cols-4 gap-1">
        <Action icon="bookmark" label="Save" pressed={isSaved} tone="text-save" onClick={() => toggleSaved(product.slug)} />
        <Action icon="bell" label="Price alert" pressed={alertOn} tone="text-positive" onClick={() => toggleAlert(product.slug)} />
        <Action icon="chat" label="Ask seller" onClick={onAsk} />
        <Action icon="expand" label="Full page" href={`/p/${product.slug}`} />
      </div>
      <BuyBox key={product.slug} product={product} variant="panel" />
    </div>
  );
}

/** Everything tagged in the video, one tap to switch the buy box, one more to take the whole outfit. */
function LookStrip({ look, selected, onSelect }: { look: Product[]; selected: string; onSelect: (slug: string) => void }) {
  const money = useMoney();
  const { addToCart } = useStore();
  const [added, setAdded] = useState(false);
  const buyable = look.filter((p) => p.price !== undefined);
  const total = buyable.reduce((n, p) => n + unitPrice(p, p.moq ?? 1) * (p.moq ?? 1), 0);

  function addAll() {
    for (const p of buyable) {
      const option = (p.options ?? []).map((o) => o.values[o.defaultIndex ?? 0]?.label).join(" · ");
      addToCart({ slug: p.slug, title: p.title, image: p.images[0], option: option || undefined, unitPrice: unitPrice(p, p.moq ?? 1), qty: p.moq ?? 1, note: "Shop the look" });
    }
    setAdded(true);
  }

  return (
    <section aria-label="Shop the look" className="glass-inset rounded-[22px] p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold">
          Shop the look <span className="font-semibold text-ink-3">· {look.length} items</span>
        </h3>
        {added ? (
          <Link href="/checkout" className="flex h-8 items-center gap-1 rounded-full bg-positive/15 px-3 text-xs font-bold text-positive">
            <Icon name="check" className="size-3.5" />
            Added · View bag
          </Link>
        ) : (
          <button type="button" onClick={addAll} className="h-8 rounded-full bg-white px-3 text-xs font-bold text-black">
            Add all · {money(total)}
          </button>
        )}
      </div>
      <ul className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
        {look.map((p) => (
          <li key={p.slug} className="shrink-0">
            <button
              type="button"
              aria-pressed={p.slug === selected}
              onClick={() => onSelect(p.slug)}
              className={`flex w-[132px] items-center gap-2 rounded-2xl p-1.5 text-left transition-colors ${p.slug === selected ? "bg-white/15 ring-1 ring-white/40" : "hover:bg-white/5"}`}
            >
              <Image src={p.images[0]} alt="" width={40} height={40} sizes="40px" className="size-10 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{p.title}</span>
                <span className="block font-display text-xs font-bold">{p.price === undefined ? "Quote" : money(p.price)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Action({
  icon,
  label,
  pressed,
  tone = "",
  href,
  onClick,
}: {
  icon: IconName;
  label: string;
  pressed?: boolean;
  tone?: string;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className={`glass-inset grid size-12 place-items-center rounded-full ${pressed ? tone : "text-ink"}`}>
        <Icon name={icon} filled={pressed} className={`size-[22px] ${pressed ? "motion-safe:animate-pop" : ""}`} />
      </span>
      {label}
    </>
  );
  const className = "flex flex-col items-center gap-1.5 text-xs font-semibold text-ink-2";
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={className}>
      {body}
    </button>
  );
}

