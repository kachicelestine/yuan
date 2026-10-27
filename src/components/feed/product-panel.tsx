"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { DetailsTab } from "./details-tab";
import type { FeedItem } from "./feed-slide";
import { MoreTab } from "./more-tab";
import { ShopTab } from "./shop-tab";
import { SocialTab } from "./social-tab";

export type PanelTab = "shop" | "social" | "details" | "more";

const tabs: { id: PanelTab; label: string }[] = [
  { id: "shop", label: "Shop" },
  { id: "social", label: "Social" },
  { id: "details", label: "Details" },
  { id: "more", label: "More" },
];

type Props = {
  item: FeedItem;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  /** The look item the shop tab shows; null for the video's own product. */
  focus: string | null;
  onFocus: (slug: string) => void;
  liked: boolean;
  /** Likes on the video, counting yours. */
  likes: number;
  onLike: () => void;
  followed: boolean;
  onFollow: () => void;
  onNotInterested: () => void;
  /** Shows a close button; the desktop panel has none. */
  onClose?: () => void;
};

/**
 * Everything you can do with the video on screen, sorted into tabs: Shop (every operation
 * on the product), Social (likes, comments, the creator), Details and More. The phone
 * sheet and the desktop side panel both render this.
 */
export function ProductPanel({ item, tab, onTab, focus, onFocus, liked, likes, onLike, followed, onFollow, onNotInterested, onClose }: Props) {
  const money = useMoney();
  const { video, seller } = item;
  const product = item.look.find((p) => p.slug === focus) ?? item.product;
  const id = useId();
  const [draft, setDraft] = useState("");
  const composer = useRef<HTMLInputElement>(null);
  const index = tabs.findIndex((t) => t.id === tab);

  // "Ask seller" and "Reply" open the comment box with a mention ready. Flushing first lets
  // focus land within the same tap, which phones need before they raise the keyboard.
  function mention(name: string) {
    flushSync(() => {
      onTab("social");
      setDraft(`@${name} `);
    });
    composer.current?.focus();
  }

  function onTabKey(event: React.KeyboardEvent) {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = tabs[(moves[event.key] + tabs.length) % tabs.length];
    onTab(next.id);
    document.getElementById(`${id}-${next.id}-tab`)?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 touch-none flex-col gap-3 px-4 pt-1 pb-3">
        <div className="flex items-center gap-3">
          <Link href={`/p/${product.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Image src={product.images[0]} alt="" width={48} height={48} sizes="48px" className="size-12 shrink-0 rounded-2xl object-cover" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{product.title}</span>
              <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-2">
                <b className="font-display text-base font-bold text-ink">{product.price === undefined ? "Landed quote" : money(product.price)}</b>
                {product.was && <s>{money(product.was)}</s>}
                <Icon name="star" filled className="ml-0.5 size-3.5 text-save" />
                {product.rating}
              </span>
            </span>
          </Link>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="glass-inset grid size-9 shrink-0 place-items-center rounded-full">
              <Icon name="close" className="size-[18px]" />
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="What to do with this video"
          onKeyDown={onTabKey}
          className="relative grid grid-cols-4 rounded-full bg-white/[0.07] p-1 shadow-[inset_0_0_0_0.75px_rgb(255_255_255/0.1)]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc((100%-8px)/4)] rounded-full bg-white/[0.16] shadow-[inset_0_0_0_0.75px_rgb(255_255_255/0.24),inset_0_1px_0_rgb(255_255_255/0.2)] transition-transform duration-500 ease-spring"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`${id}-${t.id}-tab`}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              aria-controls={`${id}-${t.id}`}
              tabIndex={t.id === tab ? 0 : -1}
              onClick={() => onTab(t.id)}
              className={`relative h-9 rounded-full text-[13px] font-semibold transition-colors ${t.id === tab ? "text-ink" : "text-ink-2 hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <Panel id={id} tab="shop" active={tab}>
        <ShopTab product={product} look={item.look} onFocus={onFocus} onAsk={() => mention(seller.name)} />
      </Panel>
      <Panel id={id} tab="social" active={tab}>
        <SocialTab
          video={video}
          seller={seller}
          creator={item.creator}
          liked={liked}
          likes={likes}
          onLike={onLike}
          followed={followed}
          onFollow={onFollow}
          draft={draft}
          onDraft={setDraft}
          composer={composer}
          onReply={mention}
        />
      </Panel>
      <Panel id={id} tab="details" active={tab}>
        <DetailsTab video={video} product={product} onShop={() => onTab("shop")} />
      </Panel>
      <Panel id={id} tab="more" active={tab}>
        <MoreTab item={item} followed={followed} onNotInterested={onNotInterested} />
      </Panel>
    </div>
  );
}

// Panels stay mounted while hidden, so a half-finished comment or a chosen size survives a tab switch.
function Panel({ id, tab, active, children }: { id: string; tab: PanelTab; active: PanelTab; children: React.ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`${id}-${tab}`}
      aria-labelledby={`${id}-${tab}-tab`}
      hidden={tab !== active}
      data-sheet-scroll
      className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      {children}
    </div>
  );
}

