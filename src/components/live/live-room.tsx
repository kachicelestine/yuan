"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import type { Product, Seller } from "@/lib/catalog";
import { compact } from "@/lib/format";
import type { LotView, MessageView, ShowView } from "@/modules/live";
import { heartAction, holdPriceAction, sayAction } from "@/server/actions/live";
import { LivePlayer } from "./live-player";
import { useLiveStream } from "./use-live-stream";

type Props = {
  show: ShowView;
  seller: Seller;
  messages: MessageView[];
  lots: LotView[];
  /** The show's products by slug. */
  products: Record<string, Product>;
};

const HEART_COLORS = ["text-like", "text-save", "text-positive", "text-verified", "text-accent-light"];

/** A live show: the stream, the host's products at live prices, chat and hearts, all live. */
export function LiveRoom({ show: initialShow, seller, messages: initialMessages, lots: initialLots, products }: Props) {
  const money = useMoney();
  const { addToCart, account } = useStore();
  const live = useLiveStream({ show: initialShow, messages: initialMessages, lots: initialLots });
  const { show } = live;
  const [muted, setMuted] = useState(true);
  const [bagged, setBagged] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [hearts, setHearts] = useState<{ id: number; color: string; x: number }[]>([]);
  const heartId = useRef(0);
  const items = show.items.flatMap((i) => (products[i.slug] ? [{ ...i, product: products[i.slug] }] : []));
  const onAir = items.find((i) => i.status === "on-air") ?? items[0];
  const ordered = onAir ? [onAir, ...items.filter((i) => i !== onAir)] : items;
  const ended = show.status === "ended";

  function float() {
    const id = ++heartId.current;
    setHearts((h) => [...h.slice(-12), { id, color: HEART_COLORS[id % HEART_COLORS.length], x: (id * 7) % 22 }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1600);
  }

  // Hearts from everyone else float up too (yours already did when you tapped).
  const lastHearts = useRef(live.hearts);
  const mine = useRef(0);
  useEffect(() => {
    for (let n = live.hearts - lastHearts.current; n > 0; n--) {
      if (mine.current > 0) mine.current--;
      else float();
    }
    lastHearts.current = live.hearts;
  }, [live.hearts]);

  async function grab(item: (typeof items)[number]) {
    setProblem(null);
    if (!account) return setProblem("Sign in to get the live price.");
    const r = await holdPriceAction(show.id, item.slug);
    if (!r.ok) return setProblem(r.message);
    addToCart({ slug: item.slug, title: item.product.title, image: item.product.images[0], unitPrice: r.price, qty: 1, note: "Live price held 30 min" });
    setBagged((b) => [...b, item.slug]);
  }

  async function onComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = new FormData(form).get("comment")?.toString().trim();
    if (!text) return;
    setProblem(null);
    const r = await sayAction(show.id, text);
    if (!r.ok) return setProblem(r.message);
    live.addMessage(r.message);
    form.reset();
  }

  return (
    <div className="lg:flex lg:h-full lg:items-center lg:justify-center lg:gap-6 lg:px-6 lg:py-5">
      <div
        data-tone="light"
        className="fixed inset-0 overflow-hidden bg-black lg:relative lg:inset-auto lg:aspect-[9/16] lg:h-full lg:max-w-full lg:rounded-[28px] lg:shadow-[0_30px_80px_rgb(0_0_0/0.5),0_0_0_0.5px_rgb(255_255_255/0.12)]"
      >
        <Image src={show.coverUrl} alt={`${show.hostName} presenting products live`} fill loading="eager" fetchPriority="high" quality={55} sizes="(min-width: 1024px) 480px, 100vw" className="object-cover" />
        {show.playbackUrl && <LivePlayer src={show.playbackUrl} muted={muted} className="absolute inset-0 size-full object-cover" />}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.45),transparent_22%,transparent_40%,rgb(0_0_0/0.78))]" />

        <header className="pt-safe absolute inset-x-3 top-0 z-10 flex items-center gap-2 lg:top-3">
          <Link href={`/s/${seller.id}`} className="glass flex h-14 min-w-0 items-center gap-2 rounded-full pr-4 pl-1.5">
            <Image src={seller.avatar} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-full object-cover" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">
                {show.hostName} · {seller.name}
              </span>
              <span className="block text-[11px] font-semibold text-ink-2">
                {ended ? "Ended" : live.viewers === null ? "Joining…" : `${compact(Math.max(live.viewers, 1))} watching`}
              </span>
            </span>
          </Link>
          {show.playbackUrl && (
            <button type="button" aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"} onClick={() => setMuted(!muted)} className="glass ml-auto grid size-11 shrink-0 place-items-center rounded-full">
              <Icon name={muted ? "soundOff" : "sound"} className="size-5" />
            </button>
          )}
          <Link href="/live" aria-label="Back to all lives" className={`glass grid size-11 shrink-0 place-items-center rounded-full ${show.playbackUrl ? "" : "ml-auto"}`}>
            <Icon name="close" className="size-5" strokeWidth={2.2} />
          </Link>
        </header>

        <div className="absolute top-[calc(max(env(safe-area-inset-top),12px)+66px)] left-3 z-10 flex gap-1.5 lg:top-[78px]">
          {ended ? (
            <span className="glass flex h-[26px] items-center rounded-full px-2.5 text-[11px] font-extrabold tracking-[0.08em]">ENDED</span>
          ) : show.status === "scheduled" ? (
            <span className="glass flex h-[26px] items-center rounded-full px-2.5 text-[11px] font-extrabold tracking-[0.08em]">STARTING SOON</span>
          ) : (
            <span className="flex h-[26px] items-center gap-1.5 rounded-full bg-live px-2.5 text-[11px] font-extrabold tracking-[0.08em]">
              <span className="size-1.5 rounded-full bg-white motion-safe:animate-blink" />
              LIVE
            </span>
          )}
          {show.place && (
            <span className="glass flex h-[26px] items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold">
              <Icon name="pin" className="size-3.5" />
              {show.place}
            </span>
          )}
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute right-4 bottom-[calc(max(env(safe-area-inset-bottom),16px)+190px)] h-[300px] w-14">
          {hearts.map((h) => (
            <Icon key={h.id} name="heart" filled className={`absolute bottom-0 size-[30px] animate-float ${h.color}`} style={{ left: `${h.x}px`, animationIterationCount: 1 }} />
          ))}
        </div>

        <div className="bottom-safe absolute inset-x-0 z-10 flex flex-col gap-2">
          <div className="mr-20 ml-3 flex flex-col gap-1.5">
            {show.pinned && (
              <div className="flex items-start gap-2 self-start rounded-2xl bg-black/45 px-2.5 py-2 text-[12.5px] ring-1 ring-white/10 backdrop-blur-md">
                <Icon name="pin" className="mt-0.5 size-3.5 shrink-0 text-save" />
                <p>
                  <b className="font-semibold">{show.pinned.q}</b> <span className="text-white/80">{show.pinned.a}</span>
                </p>
              </div>
            )}
            <ul aria-live="polite" aria-label="Live chat" className="flex h-[132px] flex-col justify-end gap-1.5 overflow-hidden [mask-image:linear-gradient(180deg,transparent,#000_34%)]">
              {live.messages.slice(-8).map((c) => (
                <li key={c.id} className={`self-start rounded-2xl px-2.5 py-1.5 text-[13px] motion-safe:animate-rise ${c.host ? "bg-accent/60 ring-[0.5px] ring-white/30" : "bg-black/35"}`}>
                  <b className={`mr-1.5 ${c.host ? "text-white" : "text-[#FFE1A8]"}`}>{c.name}</b>
                  {c.text}
                </li>
              ))}
            </ul>
          </div>

          {problem && (
            <p role="alert" className="mx-3 self-start rounded-full bg-black/60 px-3 py-1.5 text-xs">
              {problem}{" "}
              {!account && (
                <Link href={`/signin?next=${encodeURIComponent(`/live/${show.id}`)}`} className="font-bold underline">
                  Sign in
                </Link>
              )}
            </p>
          )}

          <ul aria-label="Products in this live" className="no-scrollbar flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto px-3">
            {ordered.map((item) => {
              const isOnAir = item === onAir && !ended;
              const inBag = bagged.includes(item.slug);
              const price = item.livePrice ?? item.product.price;
              return (
                <li key={item.slug} className={`shrink-0 snap-start ${isOnAir ? "w-[290px]" : "w-[220px]"}`}>
                  <div className={`flex h-full items-center gap-2.5 rounded-3xl p-2 ${isOnAir ? "glass" : "bg-black/45 ring-1 ring-white/10 backdrop-blur-md"}`}>
                    <Image src={item.product.images[0]} alt="" width={56} height={56} sizes="56px" className={`shrink-0 rounded-2xl object-cover ${isOnAir ? "size-16" : "size-12"}`} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`flex items-center gap-1 text-[10.5px] font-bold tracking-wide ${isOnAir ? "text-accent-light" : "text-white/60"}`}>
                        {isOnAir ? (
                          <>
                            <Icon name="bolt" filled className="size-3.5" />
                            ON AIR
                          </>
                        ) : item.status === "shown" ? (
                          "SHOWN EARLIER"
                        ) : (
                          "UP NEXT"
                        )}
                      </span>
                      <span className="truncate text-[13px] font-semibold">{item.product.title}</span>
                      <span className="flex items-baseline gap-1.5 font-display text-base font-extrabold">
                        {price !== undefined && price !== null ? money(price) : "Quote"}
                        {item.livePrice !== null && item.product.price !== undefined && item.product.price > item.livePrice && <s className="font-sans text-[11px] font-medium text-ink-2">{money(item.product.price)}</s>}
                      </span>
                    </div>
                    {item.livePrice !== null && !ended ? (
                      <button
                        type="button"
                        disabled={inBag}
                        onClick={() => grab(item)}
                        className={`flex shrink-0 flex-col items-center justify-center self-stretch rounded-2xl px-1 text-[13px] font-bold ${isOnAir ? "w-16" : "w-14"} ${inBag ? "bg-white/20" : isOnAir ? "bg-accent" : "bg-white/15"}`}
                      >
                        {inBag ? "In bag" : isOnAir ? "Grab" : "Add"}
                        {isOnAir && !inBag && <span className="text-[10px] font-semibold opacity-90">live price</span>}
                      </button>
                    ) : (
                      <Link href={`/p/${item.slug}`} className="flex h-11 shrink-0 items-center rounded-full bg-white/15 px-3 text-xs font-bold">
                        View
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2 px-3">
            <form onSubmit={onComment} className="glass flex h-[52px] min-w-0 flex-1 items-center rounded-full pr-1.5 pl-4">
              <label htmlFor="live-comment" className="sr-only">
                Comment
              </label>
              <input id="live-comment" name="comment" autoComplete="off" maxLength={200} disabled={ended} placeholder={ended ? "This live has ended" : `Ask ${show.hostName} anything…`} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-2" />
              <button type="submit" aria-label="Send" disabled={ended} className="grid size-10 place-items-center rounded-full">
                <Icon name="send" className="size-5" />
              </button>
            </form>
            <Link href="/checkout" aria-label={`Bag, ${bagged.length} from this live`} className="glass relative grid size-[52px] shrink-0 place-items-center rounded-full">
              <Icon name="bag" />
              {bagged.length > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold text-black">{bagged.length}</span>}
            </Link>
            <button
              type="button"
              aria-label="Send a heart"
              disabled={ended}
              onClick={() => {
                float();
                mine.current++;
                void heartAction(show.id);
              }}
              className="glass grid size-[52px] shrink-0 place-items-center rounded-full text-like"
            >
              <Icon name="heart" filled />
            </button>
          </div>
        </div>
        <h1 className="sr-only">{show.title}</h1>
      </div>
    </div>
  );
}
