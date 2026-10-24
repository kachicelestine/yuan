"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { Icon } from "@/components/icon";

export type FeedKind = "foryou" | "following";

const labels: Record<FeedKind, string> = { foryou: "For You", following: "Following" };

/** "For You ▾": a single glass pill on top of the feed, with the other feeds in a popover menu. */
export function FeedSwitcher({ feed, onFeed }: { feed: FeedKind; onFeed: (feed: FeedKind) => void }) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);

  function pick(next: FeedKind) {
    onFeed(next);
    menu.current?.hidePopover();
  }

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        className="glass glass-bar pointer-events-auto flex h-12 items-center gap-1.5 rounded-full pr-3.5 pl-[18px] text-[15px] font-semibold"
      >
        {labels[feed]}
        <Icon name="down" className="size-4 text-ink-2" />
      </button>
      {/* The header ignores pointer events so taps reach the video; the menu takes them back. */}
      <div
        ref={menu}
        id={id}
        popover="auto"
        className="menu-pop glass-sheet pointer-events-auto fixed inset-auto top-[calc(max(env(safe-area-inset-top),12px)+56px)] left-3 m-0 w-56 rounded-[22px] border-0 p-1.5 text-ink"
      >
        {(["foryou", "following"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => pick(kind)}
            aria-current={kind === feed ? "true" : undefined}
            className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold hover:bg-white/10"
          >
            <Icon name="check" className={`size-[18px] ${kind === feed ? "" : "invisible"}`} />
            {labels[kind]}
          </button>
        ))}
        <div className="mx-3 my-1 h-px bg-line" />
        <Link href="/live" className="flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold hover:bg-white/10">
          <span className="grid size-[18px] place-items-center">
            <span className="size-2 rounded-full bg-like shadow-[0_0_0_3px_rgb(255_59_92/0.28)]" />
          </span>
          Live now
        </Link>
      </div>
    </>
  );
}

