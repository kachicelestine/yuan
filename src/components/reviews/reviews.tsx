"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { Chip } from "@/components/search/filters-sheet";
import { useStore } from "@/components/providers";
import { TranslateText } from "@/components/translate-text";
import type { Review, ReviewSummary } from "@/lib/catalog";
import { compact } from "@/lib/format";
import { reactAction } from "@/server/actions/content";

export function Stars({ value, className = "size-3.5" }: { value: number; className?: string }) {
  return (
    <span className="flex text-save" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" filled={value >= i - 0.25} className={`${className} ${value >= i - 0.25 ? "" : "text-white/25"}`} />
      ))}
    </span>
  );
}

/** The headline rating, star distribution and per-aspect scores. */
export function RatingSummary({ rating, count, summary }: { rating: number; count: number; summary: ReviewSummary }) {
  const max = Math.max(...summary.stars, 1);
  return (
    <div className="glass-inset grid gap-4 rounded-[24px] p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:gap-6">
      <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
        <span className="font-display text-[44px] leading-none font-extrabold tracking-[-0.03em]">{rating}</span>
        <span>
          <Stars value={rating} className="size-4" />
          <span className="mt-0.5 block text-xs text-ink-2">{count.toLocaleString("en-US")} reviews</span>
        </span>
      </div>
      <ol className="flex flex-col gap-1" aria-label="Star distribution">
        {summary.stars.map((n, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px] text-ink-2">
            <span className="w-3 text-right">{5 - i}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-save" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="w-9 text-right">{compact(n)}</span>
          </li>
        ))}
      </ol>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {summary.aspects.map((a) => (
          <li key={a.label} className="text-xs">
            <span className="flex justify-between text-ink-2">
              {a.label}
              <b className="font-semibold text-ink">{a.score.toFixed(1)}</b>
            </span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-positive" style={{ width: `${(a.score / 5) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Filter = "all" | "photos" | "five" | "translated";

/** Reviews with filters: with photos, five stars, translated. */
export function ReviewList({ reviews, showProduct }: { reviews: (Review & { productTitle?: string })[]; showProduct?: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = reviews.filter((r) => filter === "all" || (filter === "photos" ? r.photos?.length : filter === "five" ? r.rating === 5 : r.translatedFrom));
  const counts = { photos: reviews.filter((r) => r.photos?.length).length, translated: reviews.filter((r) => r.translatedFrom).length };

  return (
    <div className="flex flex-col gap-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        <Chip on={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        {counts.photos > 0 && (
          <Chip on={filter === "photos"} onClick={() => setFilter("photos")}>
            <Icon name="camera" className="size-3.5" />
            With photos {counts.photos}
          </Chip>
        )}
        <Chip on={filter === "five"} onClick={() => setFilter("five")}>
          5 stars
        </Chip>
        {counts.translated > 0 && (
          <Chip on={filter === "translated"} onClick={() => setFilter("translated")}>
            <Icon name="globe" className="size-3.5" />
            Translated {counts.translated}
          </Chip>
        )}
      </div>
      <ul className="flex flex-col gap-2.5">
        {shown.map((r) => (
          <li key={r.id}>
            <ReviewCard review={r} productTitle={showProduct ? r.productTitle : undefined} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewCard({ review: r, productTitle }: { review: Review; productTitle?: string }) {
  const [original, setOriginal] = useState(false);
  const [helpful, setHelpful] = useState(false);
  const { markets, account } = useStore();
  const market = markets.find((m) => m.code === r.country);

  return (
    <article className="glass-inset rounded-[22px] p-4">
      <header className="flex items-center gap-2.5">
        <Image src={r.avatar} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            {r.author}
            <Flag code={r.country} className="size-3.5" />
            <span className="font-normal text-ink-3">{market?.name ?? r.country}</span>
          </p>
          <p className="flex items-center gap-2 text-[11px] text-ink-3">
            <Stars value={r.rating} className="size-3" />
            {r.date}
            {r.option && <span className="truncate">· {r.option}</span>}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-positive/15 px-2 py-0.5 text-[10.5px] font-bold text-positive">
          <Icon name="check" className="size-3" />
          Bought
        </span>
      </header>
      {productTitle && <p className="mt-2 text-xs font-semibold text-ink-2">{productTitle}</p>}
      <p className="mt-2.5 text-[15px] leading-relaxed">{original && r.original ? r.original : r.text}</p>
      {!r.translatedFrom && (
        <div className="mt-1.5">
          <TranslateText text={r.text} />
        </div>
      )}
      {r.translatedFrom && (
        <button type="button" onClick={() => setOriginal(!original)} className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-agent">
          <Icon name="globe" className="size-3.5" />
          {original ? "Show translation" : `Translated from ${r.translatedFrom} · Show original`}
        </button>
      )}
      {r.photos && r.photos.length > 0 && (
        <div className="mt-3 flex gap-2">
          {r.photos.map((src) => (
            <Image key={src} src={src} alt="Photo from the buyer" width={84} height={84} sizes="84px" className="size-[84px] rounded-2xl object-cover" />
          ))}
        </div>
      )}
      {r.sellerReply && (
        <p className="mt-3 rounded-2xl bg-white/[0.06] px-3.5 py-2.5 text-[13px] leading-snug text-ink-2">
          <b className="mb-0.5 block text-[11px] font-bold tracking-wide text-accent-light">SELLER REPLY</b>
          {r.sellerReply}
        </p>
      )}
      <button
        type="button"
        aria-pressed={helpful}
        onClick={() => {
          setHelpful(!helpful);
          if (account) void reactAction({ target: "review", id: r.id, on: !helpful });
        }}
        className={`mt-3 flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${helpful ? "bg-white text-black" : "bg-white/[0.07] text-ink-2"}`}
      >
        <Icon name="check" className="size-3.5" />
        Helpful · {r.helpful + (helpful ? 1 : 0)}
      </button>
    </article>
  );
}

