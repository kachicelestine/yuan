"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { ProductTile } from "@/components/product/product-tile";
import { useStore } from "@/components/providers";
import { categories } from "@/lib/catalog";
import { useFeedPrefs, whySeeing } from "./feed-prefs";
import type { FeedItem } from "./feed-slide";

/** More: where to go next, and a say in what the feed shows you. */
export function MoreTab({ item, followed, onNotInterested }: { item: FeedItem; followed: boolean; onNotInterested: () => void }) {
  const { seller, related } = item;
  const { market } = useStore();
  const { prefs, cycle, lean, mute, reset } = useFeedPrefs();
  const [reported, setReported] = useState(false);
  const [tuning, setTuning] = useState(false);
  const topic = item.product.category;
  const way = prefs.more.includes(topic) ? "more" : prefs.less.includes(topic) ? "less" : null;
  const muted = prefs.muted.includes(seller.id);

  return (
    <div className="pb-safe flex flex-col gap-6 px-4 pt-1">
      {related.fromSeller.length > 0 && (
        <section>
          <h3 className="mb-2.5 text-[15px] font-bold">More from {seller.name}</h3>
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4">
            {related.fromSeller.map((product) => (
              <li key={product.slug} className="w-[136px] shrink-0 snap-start">
                <ProductTile product={product} sizes="136px" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.similar.length > 0 && (
        <section>
          <h3 className="mb-2.5 text-[15px] font-bold">
            Similar items <span className="font-semibold text-ink-3">· {related.category}</span>
          </h3>
          <ul className="grid grid-cols-2 gap-2.5">
            {related.similar.map((product) => (
              <li key={product.slug}>
                <ProductTile product={product} sizes="(min-width: 1280px) 180px, 45vw" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="why-h" className="glass-inset rounded-[20px] p-4">
        <h3 id="why-h" className="flex items-center gap-1.5 text-[13px] font-bold">
          <Icon name="sparkle" className="size-4 text-agent" />
          Why you&apos;re seeing this
        </h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
          {whySeeing(item, prefs, followed, market).map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-3" />
              {r}
            </li>
          ))}
        </ul>
        <div role="group" aria-label={`Show more or less ${related.category}`} className="mt-3 grid grid-cols-2 gap-1.5">
          {(["more", "less"] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={way === w}
              onClick={() => lean(topic, way === w ? null : w)}
              className={`h-10 rounded-full text-[13px] font-semibold transition-colors ${way === w ? (w === "more" ? "bg-positive/20 text-positive ring-1 ring-positive/40" : "bg-like/15 text-like ring-1 ring-like/35") : "bg-white/[0.07] text-ink-2"}`}
            >
              {w === "more" ? "More like this" : "Less like this"}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Feed controls" className="glass-inset flex flex-col divide-y divide-line overflow-hidden rounded-[20px]">
        <button type="button" aria-pressed={muted} onClick={() => mute(seller.id)} className="flex min-h-14 items-center gap-3 px-4 py-2.5 text-left">
          <Icon name="bell" className={`size-5 ${muted ? "text-like" : "text-ink-2"}`} />
          <span>
            <span className="block text-[15px] font-semibold">{muted ? `${seller.name} is muted` : `Mute ${seller.name}`}</span>
            <span className="block text-xs text-ink-2">{muted ? "Tap to see their videos again" : "Skip their videos, keep their store"}</span>
          </span>
        </button>
        <button type="button" aria-expanded={tuning} onClick={() => setTuning(!tuning)} className="flex min-h-14 items-center gap-3 px-4 py-2.5 text-left">
          <Icon name="sliders" className="size-5 text-ink-2" />
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Tune your feed</span>
            <span className="block text-xs text-ink-2">
              {prefs.more.length + prefs.less.length === 0 ? "Pick topics to see more or less of" : `${prefs.more.length} more · ${prefs.less.length} less · ${prefs.muted.length} muted`}
            </span>
          </span>
          <Icon name={tuning ? "up" : "down"} className="size-4 text-ink-3" />
        </button>
        {tuning && (
          <div className="px-4 py-3">
            <p className="mb-2 text-xs text-ink-2">Tap once for more, twice for less, three times to reset.</p>
            <ul className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const state = prefs.more.includes(c.id) ? "more" : prefs.less.includes(c.id) ? "less" : null;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => cycle(c.id)}
                      aria-label={`${c.label}: ${state ?? "normal"}`}
                      className={`flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition-colors ${state === "more" ? "bg-positive/20 text-positive ring-1 ring-positive/40" : state === "less" ? "bg-white/[0.04] text-ink-3 line-through" : "bg-white/[0.08] text-ink-2"}`}
                    >
                      {state === "more" && <Icon name="plus" className="size-3.5" />}
                      {state === "less" && <Icon name="minus" className="size-3.5" />}
                      {c.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            {(prefs.more.length > 0 || prefs.less.length > 0 || prefs.muted.length > 0) && (
              <button type="button" onClick={reset} className="mt-3 text-[13px] font-semibold text-agent">
                Reset everything
              </button>
            )}
          </div>
        )}
        <button type="button" onClick={onNotInterested} className="flex min-h-14 items-center gap-3 px-4 py-2.5 text-left">
          <Icon name="eyeOff" className="size-5 text-ink-2" />
          <span>
            <span className="block text-[15px] font-semibold">Not interested</span>
            <span className="block text-xs text-ink-2">Hide this video and show fewer like it</span>
          </span>
        </button>
        <button type="button" onClick={() => setReported(true)} disabled={reported} className="flex min-h-14 items-center gap-3 px-4 py-2.5 text-left">
          <Icon name="flag" className="size-5 text-like" />
          <span className="text-[15px] font-semibold" aria-live="polite">
            {reported ? "Reported. Thanks, we'll take a look." : "Report this video"}
          </span>
        </button>
      </section>
    </div>
  );
}

