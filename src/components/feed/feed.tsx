"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useChrome } from "@/components/shell/chrome";
import { Sheet, type Detent } from "@/components/sheet";
import { haptic } from "@/lib/feedback";
import { useStored } from "@/lib/use-stored";
import { useFeedPrefs, weight } from "./feed-prefs";
import { FeedSlide, type FeedItem } from "./feed-slide";
import { FeedSwitcher, type FeedKind } from "./feed-switcher";
import { ProductPanel, type PanelTab } from "./product-panel";
import { ProductPeek } from "./product-peek";

// Phones: the video has the screen to itself. A feed switcher and search sit on top; the
// product peek docks beside the minimized tab bar and opens the shop sheet, which holds
// every action. Desktop: the same tabs live in a panel beside the player.
export function Feed({ items: all }: { items: FeedItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [feed, setFeed] = useState<FeedKind>("foryou");
  const [active, setActive] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  // Shared with storefronts, so following a seller anywhere shows up everywhere.
  const [following, setFollowing] = useStored<string[]>("app.following", []);
  const [hidden, setHidden] = useState<string[]>([]);
  const [burst, setBurst] = useState<{ id: string; x: number; y: number } | null>(null);
  const [sheet, setSheet] = useState<Detent>("closed");
  const [tab, setTab] = useState<PanelTab>("shop");
  // Which product from the look the shop tab shows; null means the video's own product.
  const [focus, setFocus] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const { navExpanded, setNavExpanded } = useChrome();

  const { prefs, lean } = useFeedPrefs();
  // Videos you've reached keep their place; only what's ahead reorders when you tune the feed.
  const [seen, setSeen] = useState<string[]>(() => all.slice(0, 1).map((item) => item.video.id));

  const allowed = (item: FeedItem) => !hidden.includes(item.video.id) && !prefs.muted.includes(item.seller.id) && (feed === "foryou" || following.includes(item.seller.id));
  const ahead = all.filter((item) => !seen.includes(item.video.id)).sort((a, b) => weight(a, prefs) - weight(b, prefs));
  const items = [...seen.map((id) => all.find((item) => item.video.id === id)!), ...ahead].filter(allowed);
  const index = Math.min(active, items.length - 1);
  // Undefined only when the Following feed is empty.
  const current = items[index] as FeedItem | undefined;

  // Let the floating bars darken while bright media sits under them.
  const tone = current?.video.tone;
  useEffect(() => {
    if (!tone) return;
    const root = document.documentElement;
    root.dataset.under = tone;
    return () => {
      delete root.dataset.under;
    };
  }, [tone]);

  // Deep links (/?v=v-solar) open the feed at that video, e.g. from search results.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("v");
    const at = id ? all.findIndex((item) => item.video.id === id) : -1;
    const el = scroller.current;
    if (at <= 0 || !el) return;
    // Pin everything up to the linked video so a stored preference can't reorder it away.
    setSeen(all.slice(0, at + 1).map((item) => item.video.id));
    el.scrollTo({ top: at * el.clientHeight });
  }, [all]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 820);
    return () => clearTimeout(t);
  }, [burst]);

  function onScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const next = Math.round(el.scrollTop / el.clientHeight);
    if (next === active) return;
    setActive(next);
    const reached = items.slice(0, next + 1).map((item) => item.video.id);
    setSeen((list) => [...list, ...reached.filter((id) => !list.includes(id))]);
    setFocus(null);
    // Like iOS, the tab bar minimizes again once you scroll on.
    setNavExpanded(false);
  }

  function step(delta: number) {
    const el = scroller.current;
    el?.scrollBy({ top: delta * el.clientHeight, behavior: "smooth" });
  }

  function switchFeed(next: FeedKind) {
    setFeed(next);
    setActive(0);
    scroller.current?.scrollTo({ top: 0 });
  }

  function openSheet(slug: string | null = null) {
    setTab("shop");
    setFocus(slug);
    setSheet("half");
  }

  const toggle = (setter: typeof setLiked, key: string) => setter((prev) => ({ ...prev, [key]: !prev[key] }));

  const panel = current && {
    item: current,
    tab,
    onTab: setTab,
    focus,
    onFocus: setFocus,
    liked: !!liked[current.video.id],
    onLike: () => toggle(setLiked, current.video.id),
    followed: following.includes(current.seller.id),
    onFollow: () =>
      setFollowing(following.includes(current.seller.id) ? following.filter((id) => id !== current.seller.id) : [...following, current.seller.id]),
    onNotInterested: () => {
      setHidden((list) => [...list, current.video.id]);
      // "Show fewer like it" means it: the topic sinks unless you asked for more of it.
      if (!prefs.more.includes(current.product.category)) lean(current.product.category, "less");
      setSheet("closed");
    },
  };

  return (
    <div className="lg:relative lg:isolate lg:flex lg:h-full lg:items-center lg:justify-center lg:gap-6 lg:px-6 lg:py-5">
      {/* Desktop: the current video, blurred, tints the stage behind the player. */}
      {current && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden lg:block">
          <Image src={current.video.image} alt="" fill sizes="10vw" className="scale-125 object-cover opacity-80 blur-[70px] saturate-150 brightness-[0.42]" />
        </div>
      )}

      <header className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between px-3 lg:hidden">
        <FeedSwitcher feed={feed} onFeed={switchFeed} />
        <div className="flex flex-col gap-2">
          <Link href="/search" aria-label="Search" className="glass glass-bar pointer-events-auto grid size-12 place-items-center rounded-full">
            <Icon name="search" />
          </Link>
          {current?.video.clip && <SoundButton muted={muted} onToggle={() => setMuted(!muted)} className="glass glass-bar pointer-events-auto grid size-12 place-items-center rounded-full" />}
        </div>
      </header>

      <div className="relative lg:aspect-[9/16] lg:h-full lg:max-w-full lg:overflow-hidden lg:rounded-[28px] lg:shadow-[0_30px_80px_rgb(0_0_0/0.5),0_0_0_0.5px_rgb(255_255_255/0.12)]">
        {current ? (
          <>
            <div ref={scroller} onScroll={onScroll} className="no-scrollbar fixed inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-contain lg:absolute">
              {items.map((item, i) => (
                <FeedSlide
                  key={item.video.id}
                  item={item}
                  index={i}
                  total={items.length}
                  active={i === index}
                  showProgress={i === index && !navExpanded}
                  burst={burst?.id === item.video.id ? burst : null}
                  onDoubleTap={(x, y) => {
                    setLiked((prev) => ({ ...prev, [item.video.id]: true }));
                    setBurst({ id: item.video.id, x, y });
                    haptic(8);
                  }}
                  onSpot={(slug) => openSheet(slug)}
                  muted={muted}
                />
              ))}
            </div>
            {/* Below xl there is no side panel, so the peek docks inside the player. */}
            <div className="absolute inset-x-3 bottom-3 hidden lg:block xl:hidden">
              <ProductPeek product={current.product} look={current.look} onOpen={() => openSheet()} className="w-full" />
            </div>
          </>
        ) : (
          <EmptyFollowing onBack={() => switchFeed("foryou")} />
        )}
      </div>

      {/* Phones: docked between the minimized tab bar and the bag, or above the bar when it expands. */}
      {current && (
        <ProductPeek
          product={current.product}
          look={current.look}
          onOpen={() => openSheet()}
          className={`fixed z-40 transition-[left,right,bottom] duration-500 ease-spring lg:hidden ${navExpanded ? "right-3 bottom-[calc(max(env(safe-area-inset-bottom),16px)+74px)] left-3" : "bottom-safe right-[68px] left-[68px]"}`}
        />
      )}

      {current && (
        <div className="hidden flex-col gap-2.5 lg:flex">
          <button type="button" aria-label="Previous video" disabled={index === 0} onClick={() => step(-1)} className="glass grid size-12 place-items-center rounded-full disabled:opacity-40">
            <Icon name="up" className="size-5" />
          </button>
          <button type="button" aria-label="Next video" disabled={index === items.length - 1} onClick={() => step(1)} className="glass grid size-12 place-items-center rounded-full disabled:opacity-40">
            <Icon name="down" className="size-5" />
          </button>
          {current.video.clip && <SoundButton muted={muted} onToggle={() => setMuted(!muted)} className="glass mt-3 grid size-12 place-items-center rounded-full" />}
        </div>
      )}

      {panel && (
        <aside aria-label="Shop this video" className="glass-sheet hidden h-full w-[400px] shrink-0 flex-col overflow-hidden rounded-[30px] pt-4 xl:flex">
          <ProductPanel key={panel.item.video.id} {...panel} />
        </aside>
      )}

      {panel && (
        <Sheet detent={sheet} onDetent={setSheet} label={`Shop: ${panel.item.product.title}`}>
          <ProductPanel key={panel.item.video.id} {...panel} onClose={() => setSheet("closed")} />
        </Sheet>
      )}
    </div>
  );
}

function SoundButton({ muted, onToggle, className }: { muted: boolean; onToggle: () => void; className: string }) {
  return (
    <button type="button" aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"} onClick={onToggle} className={className}>
      <Icon name={muted ? "soundOff" : "sound"} className="size-[22px]" />
    </button>
  );
}

function EmptyFollowing({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 grid place-items-center px-8 text-center lg:absolute">
      <div className="flex max-w-xs flex-col items-center gap-3">
        <span className="glass grid size-16 place-items-center rounded-full">
          <Icon name="users" className="size-7" />
        </span>
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">Nobody followed yet</h2>
        <p className="text-sm text-ink-2">Follow a seller from the Social tab under any video and their posts land here.</p>
        <button type="button" onClick={onBack} className="mt-2 h-11 rounded-full bg-accent px-5 text-[15px] font-bold">
          Back to For You
        </button>
      </div>
    </div>
  );
}

