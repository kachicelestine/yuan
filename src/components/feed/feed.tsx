"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { useChrome } from "@/components/shell/chrome";
import { sendReferral } from "@/components/shell/referral-capture";
import { Sheet, type Detent } from "@/components/sheet";
import { haptic } from "@/lib/feedback";
import type { FeedPage } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { useStored } from "@/lib/use-stored";
import { reactAction } from "@/server/actions/content";
import { useFeedPrefs, weight } from "./feed-prefs";
import { FeedSlide, type FeedItem } from "./feed-slide";
import { FeedSwitcher, type FeedKind } from "./feed-switcher";
import type { PanelTab } from "./product-panel";
import { ProductPeek } from "./product-peek";
import { useWatchBeacons } from "./use-watch-beacons";

// The shop panel (four tabs of product detail) isn't needed to watch the feed: on phones it
// opens in a sheet on tap. Its code loads on demand, warmed once the page is idle.
const ProductPanel = dynamic(() => import("./product-panel").then((m) => m.ProductPanel), { ssr: false });
const warmPanel = () => import("./product-panel");

/** Fetch the next page once the viewer is this many slides from the end. */
const PREFETCH_AHEAD = 3;

async function fetchPage(query: string): Promise<FeedPage | null> {
  try {
    const res = await fetch(`/api/feed?${query}`);
    return res.ok ? ((await res.json()) as FeedPage) : null;
  } catch {
    return null;
  }
}

/** Appends items, skipping any already loaded (pages are cut from an order that can refresh). */
function merge(list: FeedItem[], more: FeedItem[]) {
  const have = new Set(list.map((item) => item.video.id));
  return [...list, ...more.filter((item) => !have.has(item.video.id))];
}

// Phones: the video has the screen to itself. A feed switcher and search sit on top; the
// product peek docks beside the minimized tab bar and opens the shop sheet, which holds
// every action. Desktop: the same tabs live in a panel beside the player.
export function Feed({ first }: { first: FeedPage }) {
  const scroller = useRef<HTMLDivElement>(null);
  // Desktop shows the panel beside the video; phones never build that copy.
  const wide = useMediaQuery("(min-width: 1280px)");
  const [feed, setFeed] = useState<FeedKind>("foryou");
  const [active, setActive] = useState(0);
  // For You arrives with the page and grows as you swipe; Following loads when opened.
  const [forYou, setForYou] = useState<FeedPage>(first);
  const [followed, setFollowed] = useState<(FeedPage & { key: string }) | null>(null);
  const loading = useRef(false);
  const { account } = useStore();
  // Your own likes: what the server says (so counts don't double up) and what you've changed since.
  const [likedBefore, setLikedBefore] = useState<Set<string>>(() => new Set());
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const checkedLikes = useRef(new Set<string>());
  /** Creator videos already credited this visit. */
  const credited = useRef(new Set<string>());
  // Shared with storefronts, so following a seller anywhere shows up everywhere.
  const [following, setFollowing] = useStored<string[]>("app.following", []);
  // Bumped whenever this device follows or unfollows a person, so Following reloads.
  const [peopleRev] = useStored<number>("app.peopleRev", 0);
  const followKey = [...following].sort().join(",");
  const followingQuery = `following=${encodeURIComponent(followKey)}${account ? "&people=1" : ""}`;
  const feedKey = `${followKey}|${account ? `${account.id}:${peopleRev}` : ""}`;
  const all = feed === "foryou" ? forYou.items : followed?.key === feedKey ? followed.items : [];
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

  // Posts from people you follow stay; a shop's own videos go as soon as you unfollow it.
  const allowed = (item: FeedItem) => !hidden.includes(item.video.id) && !prefs.muted.includes(item.seller.id) && (feed === "foryou" || following.includes(item.seller.id) || !!item.creator);
  const ahead = all.filter((item) => !seen.includes(item.video.id)).sort((a, b) => weight(a, prefs) - weight(b, prefs));
  const items = [...seen.flatMap((id) => all.find((item) => item.video.id === id) ?? []), ...ahead].filter(allowed);
  const index = Math.min(active, items.length - 1);
  // Undefined only when the Following feed is empty.
  const current = items[index] as FeedItem | undefined;
  useWatchBeacons(current?.video.id);

  const isLiked = (id: string) => liked[id] ?? likedBefore.has(id);
  /** The count without your earlier like, plus your like now. */
  const likeCount = (item: FeedItem) => item.video.likes - (likedBefore.has(item.video.id) ? 1 : 0) + (isLiked(item.video.id) ? 1 : 0);

  function setLike(id: string, on: boolean) {
    if (isLiked(id) === on) return;
    setLiked((prev) => ({ ...prev, [id]: on }));
    // Signed out, a like stays on this screen; signed in, the account keeps it.
    if (!account) return;
    void reactAction({ target: "video", id, on }).then((r) => {
      if (!r.ok) setLiked((prev) => ({ ...prev, [id]: !on }));
    });
  }

  // Fetch the next page before the viewer reaches the end.
  const source = feed === "foryou" ? forYou : followed;
  const nearEnd = index >= items.length - PREFETCH_AHEAD;
  useEffect(() => {
    if (!nearEnd || !source || source.next === null || loading.current) return;
    loading.current = true;
    const query = feed === "foryou" ? `offset=${source.next}` : `${followingQuery}&offset=${source.next}`;
    void fetchPage(query).then((page) => {
      loading.current = false;
      if (!page) return;
      if (feed === "foryou") setForYou((f) => ({ items: merge(f.items, page.items), next: page.next }));
      else setFollowed((f) => (f && f.key === feedKey ? { ...f, items: merge(f.items, page.items), next: page.next } : f));
    });
  }, [nearEnd, source, feed, feedKey, followingQuery]);

  // Following loads when opened, and again if who you follow changed since.
  useEffect(() => {
    // Signed out and no shops followed: the empty state shows without asking the server.
    if (feed !== "following" || (!followKey && !account) || followed?.key === feedKey) return;
    void fetchPage(followingQuery).then((page) => setFollowed({ items: page?.items ?? [], next: page?.next ?? null, key: feedKey }));
  }, [feed, followKey, feedKey, followingQuery, account, followed?.key]);

  // Signed in: which loaded videos you liked before, asked once per video.
  const loadedIds = [...forYou.items, ...(followed?.items ?? [])].map((item) => item.video.id).join(",");
  useEffect(() => {
    if (!account) return;
    const ids = loadedIds.split(",").filter((id) => id && !checkedLikes.current.has(id));
    if (!ids.length) return;
    for (const id of ids) checkedLikes.current.add(id);
    void fetch(`/api/me/likes?target=video&ids=${ids.map(encodeURIComponent).join(",")}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ ids: string[] }>) : { ids: [] }))
      .then(({ ids: mine }) => {
        if (mine.length) setLikedBefore((prev) => new Set([...prev, ...mine]));
      })
      .catch(() => {});
  }, [account, loadedIds]);

  useEffect(() => {
    const idle = "requestIdleCallback" in window ? requestIdleCallback(() => void warmPanel(), { timeout: 6000 }) : undefined;
    return () => {
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, []);

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

  // Deep links (/?v=v-solar) open the feed on that video, e.g. from search results or a
  // shared link. It moves to the front; one that isn't loaded yet is fetched first.
  const pinned = useRef(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("v");
    if (!id || id === first.items[0]?.video.id) return;
    const pin = (item: FeedItem) => {
      pinned.current = true;
      setForYou((f) => ({ ...f, items: [item, ...f.items.filter((i) => i.video.id !== id)] }));
      setSeen([id]);
    };
    const loaded = first.items.find((item) => item.video.id === id);
    if (loaded) pin(loaded);
    else
      void fetchPage(`ids=${encodeURIComponent(id)}`).then((page) => {
        if (page?.items[0]) pin(page.items[0]);
      });
  }, [first]);
  // Scroll snapping re-snaps to the slide that was showing when the list changes, so the
  // move to the top waits until the pinned video is actually first.
  useLayoutEffect(() => {
    if (!pinned.current) return;
    pinned.current = false;
    scroller.current?.scrollTo({ top: 0 });
  }, [forYou]);

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
    // Shopping from a creator's video credits them, once per video.
    if (current?.ref && !credited.current.has(current.video.id)) {
      credited.current.add(current.video.id);
      void sendReferral(current.ref, `/p/${slug ?? current.product.slug}`);
    }
    setTab("shop");
    setFocus(slug);
    setSheet("half");
  }

  const panel = current && {
    item: current,
    tab,
    onTab: setTab,
    focus,
    onFocus: setFocus,
    liked: isLiked(current.video.id),
    likes: likeCount(current),
    onLike: () => setLike(current.video.id, !isLiked(current.video.id)),
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
            {/* No scroll anchoring: when a shared video moves to the front, the browser would otherwise shift down a slide to keep the old first one in view. */}
            <div ref={scroller} onScroll={onScroll} className="no-scrollbar fixed inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-contain [overflow-anchor:none] lg:absolute">
              {items.map((item, i) => (
                <FeedSlide
                  key={item.video.id}
                  item={item}
                  index={i}
                  total={items.length}
                  active={i === index}
                  near={Math.abs(i - index) <= 1}
                  showProgress={i === index && !navExpanded}
                  burst={burst?.id === item.video.id ? burst : null}
                  onDoubleTap={(x, y) => {
                    setLike(item.video.id, true);
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
          {wide && <ProductPanel key={panel.item.video.id} {...panel} />}
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
        <p className="text-sm text-ink-2">Follow shops and people from the Social tab under any video, and what they post lands here.</p>
        <button type="button" onClick={onBack} className="mt-2 h-11 rounded-full bg-accent px-5 text-[15px] font-bold">
          Back to For You
        </button>
      </div>
    </div>
  );
}

