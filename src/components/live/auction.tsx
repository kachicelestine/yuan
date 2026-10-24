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
import { bidAction } from "@/server/actions/live";
import { LivePlayer } from "./live-player";
import { useLiveStream } from "./use-live-stream";

const HOLD_MS = 700;
/** How much above the minimum each quick button bids, in increments. */
const STEPS = [0, 2, 5];

type Props = { show: ShowView; seller: Seller; messages: MessageView[]; lots: LotView[]; products: Record<string, Product> };

/** A live auction: the current lot, its real clock, and hold-to-bid so a stray tap never bids. */
export function Auction({ show: initialShow, seller, messages, lots: initialLots, products }: Props) {
  const money = useMoney();
  const { account, addToCart } = useStore();
  const live = useLiveStream({ show: initialShow, messages, lots: initialLots });
  const { show } = live;
  const [step, setStep] = useState(0);
  const [holding, setHolding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(true);
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The current lot: the open one, or the one that closed most recently.
  const lot = live.lots.find((l) => l.status === "open") ?? live.lots.at(-1);
  const product = lot ? products[lot.slug] : undefined;
  const secs = lot ? Math.max(0, Math.ceil((new Date(lot.endsAt).getTime() - now) / 1000)) : 0;
  const youLead = !!lot && mine.includes(lot.id) && lot.topBid !== null;
  const next = lot ? Math.round((lot.minimumBid + STEPS[step] * lot.increment) * 100) / 100 : 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // When the clock runs out, ask the server: it closes the lot and says who won.
  const closingFor = useRef<string | null>(null);
  useEffect(() => {
    if (!lot || lot.status !== "open" || secs > 0 || closingFor.current === lot.id) return;
    closingFor.current = lot.id;
    void fetch(`/api/live/lots/${lot.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ lot: LotView }>) : null))
      .then((r) => {
        if (r) live.setLot(r.lot);
      });
  }, [lot, secs, live]);

  useEffect(() => () => clearTimeout(hold.current), []);

  async function place() {
    if (!lot) return;
    setProblem(null);
    if (!account) return setProblem("Sign in to bid.");
    const r = await bidAction(lot.id, next);
    if (!r.ok) return setProblem(r.message);
    setMine((m) => [...new Set([...m, lot.id])]);
    live.setLot(r.lot);
  }

  function startHold() {
    if (!lot || lot.status !== "open") return;
    setHolding(true);
    hold.current = setTimeout(() => {
      setHolding(false);
      void place();
    }, HOLD_MS);
  }
  function cancelHold() {
    clearTimeout(hold.current);
    setHolding(false);
  }

  const won = lot?.status === "sold" && mine.includes(lot.id) && youLead;
  const ring = 144.5;
  // The ring shows the last minute; before that it stays full.
  const total = 60;

  return (
    <div className="lg:flex lg:h-full lg:items-center lg:justify-center lg:px-6 lg:py-5">
      <div className="fixed inset-0 overflow-hidden bg-black lg:relative lg:inset-auto lg:aspect-[9/16] lg:h-full lg:max-w-full lg:rounded-[28px] lg:shadow-[0_30px_80px_rgb(0_0_0/0.5)]">
        <Image src={show.coverUrl} alt={`${show.hostName} showing lots live`} fill loading="eager" fetchPriority="high" quality={55} sizes="(min-width: 1024px) 480px, 100vw" className="object-cover" />
        {show.playbackUrl && <LivePlayer src={show.playbackUrl} muted={muted} className="absolute inset-0 size-full object-cover" />}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.5),transparent_20%,transparent_40%,rgb(0_0_0/0.85)_72%,#000)]" />

        <header className="pt-safe absolute inset-x-3 top-0 z-10 flex items-center gap-2 lg:top-3">
          <Link href={`/s/${seller.id}`} className="glass flex h-14 items-center gap-2 rounded-full px-1.5 pr-4">
            <Image src={seller.avatar} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-full object-cover" />
            <span>
              <span className="block text-sm font-bold">
                {seller.name} · {show.hostName}
              </span>
              <span className="block text-[11px] text-ink-2">{live.viewers === null ? "Joining…" : `${compact(Math.max(1, live.viewers))} watching`}</span>
            </span>
          </Link>
          {show.playbackUrl && (
            <button type="button" aria-label={muted ? "Turn sound on" : "Turn sound off"} onClick={() => setMuted(!muted)} className="glass ml-auto grid size-11 place-items-center rounded-full">
              <Icon name={muted ? "soundOff" : "sound"} className="size-5" />
            </button>
          )}
          <Link href="/live" aria-label="Leave auction" className={`glass grid size-11 place-items-center rounded-full ${show.playbackUrl ? "" : "ml-auto"}`}>
            <Icon name="close" className="size-5" strokeWidth={2.2} />
          </Link>
        </header>
        <div className="absolute top-[calc(max(env(safe-area-inset-top),12px)+66px)] left-3 z-10 flex gap-1.5 lg:top-[78px]">
          <span className="flex h-[26px] items-center gap-1.5 rounded-full bg-live px-2.5 text-[11px] font-extrabold tracking-[0.08em]">
            <span className="size-1.5 rounded-full bg-white motion-safe:animate-blink" />
            {show.status === "live" ? "LIVE" : show.status === "ended" ? "ENDED" : "SOON"}
          </span>
          <span className="glass flex h-[26px] items-center rounded-full px-2.5 text-[11px] font-bold tracking-[0.06em]">AUCTION · {live.lots.length ? `LOT ${live.lots.indexOf(lot!) + 1}` : "NO LOTS YET"}</span>
        </div>

        {lot && product ? (
          <section aria-label="Bid on this lot" className="glass-sheet bottom-safe absolute inset-x-2.5 z-10 flex flex-col gap-3 rounded-[32px] p-3.5">
            <div className="flex items-center gap-3">
              <Image src={product.images[0]} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-extrabold tracking-[0.12em] text-accent-light">STARTED AT {money(lot.startPrice)}</p>
                <Link href={`/p/${product.slug}`} className="block truncate text-[15px] font-bold">
                  {product.title}
                </Link>
                <p className="text-xs text-ink-2">{lot.bids} bids · one unit, sold to the top bid</p>
              </div>
              <div role="timer" aria-label={`${timeLeft(secs)} left`} className="relative size-14 shrink-0">
                <svg viewBox="0 0 56 56" aria-hidden="true" className="size-14 -rotate-90">
                  <circle cx="28" cy="28" r="23" fill="none" strokeWidth="5" className="stroke-white/15" />
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    fill="none"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={ring}
                    strokeDashoffset={ring * (1 - Math.min(1, secs / total))}
                    className={`transition-[stroke-dashoffset] duration-500 ease-linear ${secs <= 10 ? "stroke-live" : "stroke-white"}`}
                  />
                </svg>
                <b className="absolute inset-0 grid place-items-center text-sm font-extrabold tabular-nums">{timeLeft(secs, true)}</b>
              </div>
            </div>

            <div className="flex items-end justify-between">
              <span key={lot.topBid?.amount ?? 0} className="font-display text-[44px] leading-none font-extrabold tabular-nums motion-safe:animate-pop">
                {money(lot.topBid?.amount ?? lot.startPrice)}
              </span>
              <span className="text-right text-xs text-ink-2">
                {lot.topBid ? "Top bid" : "No bids yet"}
                {lot.topBid && <b className={`block text-sm ${youLead ? "text-positive" : "text-ink"}`}>{youLead ? "You're winning" : lot.topBid.name}</b>}
              </span>
            </div>

            {lot.status === "open" ? (
              <>
                <div role="radiogroup" aria-label="Bid amount" className="grid grid-cols-3 gap-2">
                  {STEPS.map((n, i) => (
                    <button key={n} type="button" role="radio" aria-checked={step === i} onClick={() => setStep(i)} className={`h-11 rounded-full text-sm font-extrabold transition-colors ${step === i ? "bg-white text-black" : "glass-inset"}`}>
                      {money(Math.round((lot.minimumBid + n * lot.increment) * 100) / 100)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label={`Press and hold to bid ${money(next)}`}
                  onPointerDown={startHold}
                  onPointerUp={cancelHold}
                  onPointerLeave={cancelHold}
                  onPointerCancel={cancelHold}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void place();
                    }
                  }}
                  className="relative flex h-[60px] touch-none items-center justify-center overflow-hidden rounded-full bg-accent text-[17px] font-extrabold select-none"
                >
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-white/30" style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${HOLD_MS}ms linear` : "width 0.2s" }} />
                  <span className="relative flex items-center gap-2">
                    <Icon name="gavel" className="size-5" strokeWidth={2.2} />
                    {holding ? "Keep holding…" : `Hold to bid ${money(next)}`}
                  </span>
                </button>
                <p className="-mt-1 text-center text-[11px] text-ink-2">A bid in the last 10 s adds time · hold to bid so a stray tap never counts</p>
              </>
            ) : (
              <p className="rounded-2xl bg-white/[0.07] p-3 text-center text-sm">
                {lot.status === "sold" ? `Sold for ${money(lot.topBid!.amount)}.` : "No bids: unsold."} {show.status === "live" ? "The next lot opens soon." : ""}
              </p>
            )}
            {problem && (
              <p role="alert" className="text-center text-xs text-like">
                {problem}{" "}
                {!account && (
                  <Link href={`/signin?next=${encodeURIComponent(`/live/${show.id}`)}`} className="font-bold underline">
                    Sign in
                  </Link>
                )}
              </p>
            )}
          </section>
        ) : (
          <p className="glass-sheet bottom-safe absolute inset-x-2.5 z-10 rounded-[28px] p-4 text-center text-sm text-ink-2">The host hasn&apos;t opened a lot yet. Stay tuned.</p>
        )}

        <div role="status" className={`absolute inset-0 z-20 grid place-items-center bg-black/50 transition-opacity ${won ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {won && lot && product && (
            <div className="glass-sheet w-[300px] rounded-[34px] p-6 text-center motion-safe:animate-pop">
              <p className="seal text-6xl text-accent-light">成交</p>
              <p className="mt-2 font-display text-2xl font-extrabold">Yours for {money(lot.topBid!.amount)}</p>
              <p className="mt-1 text-sm text-ink-2">We hold the price for you for 48 hours.</p>
              <button
                type="button"
                onClick={() => addToCart({ slug: product.slug, title: product.title, image: product.images[0], unitPrice: lot.topBid!.amount, qty: 1, note: "Auction win" })}
                className="mt-4 h-11 w-full rounded-full bg-accent text-sm font-bold"
              >
                Add to bag
              </button>
              <Link href="/checkout" className="mt-2 block text-sm font-semibold text-agent">
                Go to checkout
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Time left on a lot, short enough for the ring: 42, 7m, 13h, 2d. */
function timeLeft(secs: number, short = false) {
  if (secs <= 99) return short ? String(secs) : `${secs} seconds`;
  const [n, unit, word] =
    secs < 3600 ? [Math.ceil(secs / 60), "m", "minutes"] : secs < 86_400 ? [Math.ceil(secs / 3600), "h", "hours"] : [Math.ceil(secs / 86_400), "d", "days"];
  return short ? `${n}${unit}` : `${n} ${word}`;
}
