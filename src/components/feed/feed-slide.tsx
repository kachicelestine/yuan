"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import type { FeedItem } from "@/lib/types";
import { ClipPlayer } from "./clip-player";

export type { FeedItem };

type Props = {
  item: FeedItem;
  index: number;
  total: number;
  active: boolean;
  /** Within one swipe of the slide on screen; only these load their photo. */
  near: boolean;
  showProgress: boolean;
  /** Where the last double tap landed, so the heart pops under the finger. */
  burst: { x: number; y: number } | null;
  onDoubleTap: (x: number, y: number) => void;
  /** A product tag in the frame was tapped. */
  onSpot: (slug: string) => void;
  /** Sound is off until the shopper turns it on, then stays on for every clip. */
  muted: boolean;
};

// A slide is only the media. Every control lives in the shop sheet (see <Feed>), so the
// product gets the whole screen. A double tap still likes, TikTok-style.
export function FeedSlide({ item, index, total, active, near, showProgress, burst, onDoubleTap, onSpot, muted }: Props) {
  const money = useMoney();
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [paused, setPaused] = useState(false);
  const [wasActive, setWasActive] = useState(active);
  const { video, product, seller } = item;

  // Coming back to a slide plays it again, TikTok-style.
  if (active !== wasActive) {
    setWasActive(active);
    setPaused(false);
  }

  useEffect(() => () => clearTimeout(single.current), []);

  // Swipes end in pointercancel (the feed scrolls), so only real taps get here. One tap
  // pauses a clip; a second tap within 300 ms makes it a like instead.
  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (event.timeStamp - lastTap.current < 300) {
      clearTimeout(single.current);
      const box = event.currentTarget.getBoundingClientRect();
      onDoubleTap(event.clientX - box.left, event.clientY - box.top);
      lastTap.current = 0;
    } else {
      lastTap.current = event.timeStamp;
      if (video.clip && active) single.current = setTimeout(() => setPaused((p) => !p), 300);
    }
  }

  return (
    <section
      aria-label={`Video ${index + 1} of ${total}: ${product.title}, from ${seller.name}`}
      data-tone={video.tone}
      onPointerUp={onPointerUp}
      className="relative h-full snap-start snap-always overflow-hidden bg-surface select-none"
    >
      {/* The first slide's photo is what a cold visit paints first, so it outranks everything else. */}
      {near && (
        <Image
          src={video.image}
          alt=""
          fill
          loading={index === 0 ? "eager" : "lazy"}
          fetchPriority={index === 0 ? "high" : "low"}
          quality={55}
          sizes="(min-width: 1024px) 480px, 100vw"
          className={`object-cover ${active ? "motion-safe:animate-kenburns" : "scale-[1.04]"}`}
        />
      )}
      {video.clip && <ClipPlayer src={video.clip} playing={active && !paused} paused={active && paused} muted={muted} showBar={showProgress} />}
      <div aria-hidden="true" className="scrim-feed pointer-events-none absolute inset-0" />

      {/* Shop the look: tags sit on a box cropped like the photo, so they stay on the item at any screen shape. */}
      {active && video.spots && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 aspect-[9/19.5] min-h-full min-w-full -translate-x-1/2 -translate-y-1/2">
          {video.spots.map((spot, i) => {
            const p = item.look.find((l) => l.slug === spot.slug);
            if (!p) return null;
            const flip = spot.x > 50;
            return (
              <button
                key={spot.slug}
                type="button"
                aria-label={`Tagged: ${p.title}, ${p.price === undefined ? "quote" : money(p.price)}`}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={() => onSpot(spot.slug)}
                style={{ left: `${spot.x}%`, top: `${spot.y}%`, animationDelay: `${500 + i * 140}ms` }}
                className={`pointer-events-auto absolute flex -translate-y-1/2 items-center gap-1.5 [animation-fill-mode:both] motion-safe:animate-rise ${flip ? "-translate-x-[calc(100%-11px)] flex-row-reverse" : "-translate-x-[11px]"}`}
              >
                <span className="relative grid size-[22px] shrink-0 place-items-center">
                  <span className="absolute inset-0 rounded-full bg-white/40 motion-safe:animate-ping" />
                  <span className="size-3 rounded-full bg-white shadow-[0_0_0_4px_rgb(0_0_0/0.25)]" />
                </span>
                <span className="flex h-8 max-w-[170px] items-center gap-1.5 rounded-full bg-black/55 px-3 text-xs font-semibold text-white shadow-[0_4px_14px_rgb(0_0_0/0.25)] ring-1 ring-white/20 backdrop-blur-md">
                  <span className="truncate">{p.title}</span>
                  <b className="shrink-0 font-display">{p.price === undefined ? "Quote" : money(p.price)}</b>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {item.sponsored && (
        <span className="pointer-events-none absolute top-[calc(max(env(safe-area-inset-top),12px)+64px)] left-4 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur lg:top-4">
          Sponsored
        </span>
      )}

      {burst && (
        <Icon
          key={`${burst.x},${burst.y}`}
          name="heart"
          filled
          style={{ left: burst.x, top: burst.y }}
          className="pointer-events-none absolute -mt-14 -ml-14 size-28 animate-burst text-like drop-shadow-[0_10px_28px_rgb(255_59_92/0.5)]"
        />
      )}

      {showProgress && !video.clip && (
        <div
          aria-hidden="true"
          className="absolute right-5 bottom-[calc(max(env(safe-area-inset-bottom),16px)+60px)] left-5 h-0.5 overflow-hidden rounded-full bg-white/25 lg:bottom-[74px] xl:bottom-2"
        >
          <span className="block h-full w-1/3 rounded-full bg-white motion-safe:animate-progress" />
        </div>
      )}
    </section>
  );
}

