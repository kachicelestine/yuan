"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { useMoney } from "@/components/price";
import type { Product, Seller } from "@/lib/catalog";
import { clock, compact } from "@/lib/format";

export type LiveRoomItem = { product: Product; livePrice: number; status: "on-air" | "shown" | "next" };

type Props = {
  host: string;
  seller: Seller;
  title: string;
  image: string;
  place: string;
  viewers: number;
  items: LiveRoomItem[];
  comments: { name: string; text: string; host?: boolean }[];
  pinned: { q: string; a: string };
  /** "Just bought" toasts that cycle while you watch. */
  purchases: { name: string; city: string }[];
};

const HEART_COLORS = ["text-like", "text-save", "text-positive", "text-verified", "text-accent-light"];

export function LiveRoom({ host, seller, title, image, place, viewers, items, comments: seed, pinned, purchases }: Props) {
  const money = useMoney();
  const { addToCart } = useStore();
  const [secs, setSecs] = useState(134);
  const [followed, setFollowed] = useState(false);
  const [bagged, setBagged] = useState<string[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [comments, setComments] = useState(seed);
  const [hearts, setHearts] = useState<{ id: number; color: string; x: number }[]>([]);
  const [toast, setToast] = useState(0);
  const heartId = useRef(0);
  const onAir = items.find((i) => i.status === "on-air") ?? items[0];
  const ordered = [onAir, ...items.filter((i) => i !== onAir)];

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s <= 0 ? 180 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // A new "just bought" every few seconds, always for what's on air.
  useEffect(() => {
    const t = setInterval(() => setToast((n) => n + 1), 3800);
    return () => clearInterval(t);
  }, []);

  function sendHeart() {
    const id = ++heartId.current;
    setHearts((h) => [...h, { id, color: HEART_COLORS[id % HEART_COLORS.length], x: (id * 7) % 22 }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1600);
  }

  function buy(item: LiveRoomItem) {
    if (bagged.includes(item.product.slug)) return;
    addToCart({ slug: item.product.slug, title: item.product.title, image: item.product.images[0], unitPrice: item.livePrice, qty: 1, note: "LIVE PRICE HELD" });
    setBagged((b) => [...b, item.product.slug]);
  }

  function askToShow(item: LiveRoomItem) {
    setAsked((a) => [...a, item.product.slug]);
    setComments((c) => [...c.slice(-5), { name: "you", text: `@${host} can you show the ${item.product.title.split(",")[0].toLowerCase()} next?` }]);
  }

  function onComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = new FormData(form).get("comment")?.toString().trim();
    if (!text) return;
    setComments((c) => [...c.slice(-5), { name: "you", text }]);
    form.reset();
  }

  const claimed = 68 + (bagged.includes(onAir.product.slug) ? 1 : 0) + (toast % 7);
  const buyer = purchases[toast % purchases.length];

  return (
    <div className="lg:flex lg:h-full lg:items-center lg:justify-center lg:gap-6 lg:px-6 lg:py-5">
      <div
        data-tone="light"
        className="fixed inset-0 overflow-hidden bg-black lg:relative lg:inset-auto lg:aspect-[9/16] lg:h-full lg:max-w-full lg:rounded-[28px] lg:shadow-[0_30px_80px_rgb(0_0_0/0.5),0_0_0_0.5px_rgb(255_255_255/0.12)]"
      >
        <Image src={image} alt={`${host} presenting products live`} fill loading="eager" sizes="(min-width: 1024px) 480px, 100vw" className="object-cover motion-safe:animate-kenburns" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.45),transparent_22%,transparent_40%,rgb(0_0_0/0.78))]" />

        <header className="pt-safe absolute inset-x-3 top-0 z-10 flex items-center gap-2 lg:top-3">
          <div className="glass flex h-14 min-w-0 items-center gap-2 rounded-full pr-1.5 pl-1.5">
            <Image src={seller.avatar} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {host} · {seller.name}
              </p>
              <p className="text-[11px] font-semibold text-ink-2">{compact(viewers + (followed ? 1 : 0) + toast * 3)} watching</p>
            </div>
            <button type="button" aria-pressed={followed} onClick={() => setFollowed((f) => !f)} className={`ml-1 h-11 rounded-full px-3.5 text-[13px] font-bold ${followed ? "bg-white/20" : "bg-accent"}`}>
              {followed ? "Following" : "Follow"}
            </button>
          </div>
          <Link href="/live" aria-label="Back to all lives" className="glass ml-auto grid size-11 shrink-0 place-items-center rounded-full">
            <Icon name="close" className="size-5" strokeWidth={2.2} />
          </Link>
        </header>

        <div className="absolute top-[calc(max(env(safe-area-inset-top),12px)+66px)] left-3 z-10 flex flex-col items-start gap-2 lg:top-[78px]">
          <div className="flex gap-1.5">
            <span className="flex h-[26px] items-center gap-1.5 rounded-full bg-live px-2.5 text-[11px] font-extrabold tracking-[0.08em]">
              <span className="size-1.5 rounded-full bg-white motion-safe:animate-blink" />
              LIVE
            </span>
            <span className="glass flex h-[26px] items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold">
              <Icon name="pin" className="size-3.5" />
              {place}
            </span>
          </div>
          {buyer && (
            <p key={toast} role="status" className="flex h-8 items-center gap-1.5 rounded-full bg-black/45 pr-3 pl-1 text-xs font-semibold backdrop-blur-md motion-safe:animate-rise">
              <span className="grid size-6 place-items-center rounded-full bg-accent text-[10px]">
                <Icon name="bag" className="size-3.5" />
              </span>
              <b>{buyer.name}</b>
              <span className="text-white/75">in {buyer.city} just bought one</span>
            </p>
          )}
        </div>

        {/* Floating hearts: ambient ones from other viewers, plus yours. */}
        <div aria-hidden="true" className="pointer-events-none absolute right-4 bottom-[calc(max(env(safe-area-inset-bottom),16px)+190px)] h-[300px] w-14">
          {[0, 1, 2, 3, 4].map((i) => (
            <Icon key={i} name="heart" filled className={`absolute bottom-0 size-[26px] opacity-0 motion-safe:animate-float ${HEART_COLORS[i]}`} style={{ left: `${(i * 9) % 26}px`, animationDelay: `${i * 0.85}s` }} />
          ))}
          {hearts.map((h) => (
            <Icon key={h.id} name="heart" filled className={`absolute bottom-0 size-[30px] animate-float ${h.color}`} style={{ left: `${h.x}px`, animationIterationCount: 1 }} />
          ))}
        </div>

        <div className="bottom-safe absolute inset-x-0 z-10 flex flex-col gap-2">
          <div className="mr-20 ml-3 flex flex-col gap-1.5">
            <div className="flex items-start gap-2 self-start rounded-2xl bg-black/45 px-2.5 py-2 text-[12.5px] ring-1 ring-white/10 backdrop-blur-md">
              <Icon name="pin" className="mt-0.5 size-3.5 shrink-0 text-save" />
              <p>
                <b className="font-semibold">{pinned.q}</b> <span className="text-white/80">{pinned.a}</span>
              </p>
            </div>
            <ul aria-live="polite" aria-label="Live chat" className="flex h-[132px] flex-col justify-end gap-1.5 [mask-image:linear-gradient(180deg,transparent,#000_34%)]">
              {comments.map((c, i) => (
                <li
                  key={`${c.name}-${i}`}
                  style={{ animationDelay: `${Math.min(i, 5) * 0.12}s` }}
                  className={`self-start rounded-2xl px-2.5 py-1.5 text-[13px] motion-safe:animate-rise ${c.host ? "bg-accent/60 ring-[0.5px] ring-white/30" : "bg-black/35"}`}
                >
                  <b className={`mr-1.5 ${c.host ? "text-white" : "text-[#FFE1A8]"}`}>{c.name}</b>
                  {c.text}
                </li>
              ))}
            </ul>
          </div>

          <ul aria-label="Products in this live" className="no-scrollbar flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto px-3">
            {ordered.map((item) => {
              const live = item === onAir;
              const inBag = bagged.includes(item.product.slug);
              return (
                <li key={item.product.slug} className={`shrink-0 snap-start ${live ? "w-[300px]" : "w-[220px]"}`}>
                  <div className={`flex h-full items-center gap-2.5 rounded-3xl p-2 ${live ? "glass" : "bg-black/45 ring-1 ring-white/10 backdrop-blur-md"}`}>
                    <Image src={item.product.images[0]} alt="" width={56} height={56} sizes="56px" className={`shrink-0 rounded-2xl object-cover ${live ? "size-16" : "size-12"}`} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`flex items-center gap-1 text-[10.5px] font-bold tracking-wide ${live ? "text-accent-light" : "text-white/60"}`}>
                        {live ? (
                          <>
                            <Icon name="bolt" filled className="size-3.5" />
                            ON AIR · ENDS {clock(secs)}
                          </>
                        ) : item.status === "shown" ? (
                          "SHOWN EARLIER"
                        ) : (
                          "UP NEXT"
                        )}
                      </span>
                      <span className="truncate text-[13px] font-semibold">{item.product.title}</span>
                      <span className="flex items-baseline gap-1.5 font-display text-base font-extrabold">
                        {money(item.livePrice)}
                        {item.product.price !== undefined && <s className="font-sans text-[11px] font-medium text-ink-2">{money(item.product.price)}</s>}
                      </span>
                      {live && (
                        <div role="img" aria-label={`${claimed}% claimed`} className="h-1 overflow-hidden rounded-full bg-white/20">
                          <span className="block h-full rounded-full bg-gradient-to-r from-[#FFB199] to-accent-light transition-[width] duration-700" style={{ width: `${claimed}%` }} />
                        </div>
                      )}
                    </div>
                    {item.status === "next" && !live ? (
                      <button type="button" disabled={asked.includes(item.product.slug)} onClick={() => askToShow(item)} className="flex h-11 shrink-0 items-center rounded-full bg-white/15 px-3 text-xs font-bold disabled:opacity-60">
                        {asked.includes(item.product.slug) ? "Asked" : "Ask to see"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => buy(item)}
                        className={`flex shrink-0 flex-col items-center justify-center self-stretch rounded-2xl text-[13px] font-bold ${live ? "w-16" : "w-14"} ${inBag ? "bg-white/20" : live ? "bg-accent" : "bg-white/15"}`}
                      >
                        {inBag ? "In bag" : live ? "Grab" : "Add"}
                        {live && <span className="text-[10px] font-semibold opacity-90">{inBag ? `−${money((item.product.price ?? 0) - item.livePrice)}` : `${claimed}% gone`}</span>}
                      </button>
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
              <input id="live-comment" name="comment" autoComplete="off" placeholder={`Ask ${host} anything…`} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-2" />
              <button type="submit" aria-label="Send" className="grid size-10 place-items-center rounded-full">
                <Icon name="send" className="size-5" />
              </button>
            </form>
            <Link href="/checkout" aria-label={`Bag, ${bagged.length} from this live`} className="glass relative grid size-[52px] shrink-0 place-items-center rounded-full">
              <Icon name="bag" />
              {bagged.length > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold text-black">{bagged.length}</span>}
            </Link>
            <button type="button" aria-label="Send a heart" onClick={sendHeart} className="glass grid size-[52px] shrink-0 place-items-center rounded-full text-like">
              <Icon name="heart" filled />
            </button>
          </div>
        </div>
        <h1 className="sr-only">{title}</h1>
      </div>
    </div>
  );
}
