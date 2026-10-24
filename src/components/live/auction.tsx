"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { useMoney } from "@/components/price";
import type { Seller } from "@/lib/catalog";

type Lot = { title: string; image: string; start: number; current: number };

type Props = { host: string; seller: Seller; image: string; lots: Lot[] };

const LOT_SECONDS = 15;
/** A bid in the last 5 seconds pushes the clock back to 10, so nobody wins by sniping. */
const EXTEND_BELOW = 5;
const EXTEND_TO = 10;
const HOLD_MS = 700;
const INCREMENTS = [2, 5, 10];
const RIVALS = ["mei_l***", "kofi_a***", "ravi.k***", "sora***"];

type State = { lot: number; bid: number; top: string; secs: number; history: string[]; sold: { who: string; price: number } | null };

export function Auction({ host, seller, image, lots }: Props) {
  const money = useMoney();
  const { addToCart } = useStore();
  const [state, setState] = useState<State>({
    lot: 0,
    bid: lots[0].current,
    top: "mei_l***",
    secs: LOT_SECONDS,
    history: ["kofi_a*** bid $82", "ravi.k*** bid $84", "mei_l*** bid $86"],
    sold: null,
  });
  const [inc, setInc] = useState(0);
  const [holding, setHolding] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lot = lots[state.lot % lots.length];
  const youLead = state.top === "You";

  // The auction clock, plus the occasional rival bid.
  useEffect(() => {
    const t = setInterval(() => {
      setState((s) => {
        if (s.sold) return s;
        const secs = s.secs - 1;
        if (secs <= 0) return { ...s, secs: 0, sold: { who: s.top, price: s.bid } };
        if (secs > 1 && Math.random() < 0.22) {
          const who = RIVALS[Math.floor(Math.random() * RIVALS.length)];
          const bid = s.bid + 2;
          return { ...s, bid, top: who, secs: secs <= EXTEND_BELOW ? EXTEND_TO : secs, history: [...s.history.slice(1), `${who} bid $${bid}`] };
        }
        return { ...s, secs };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // After a sale, show the result, then open the next lot.
  useEffect(() => {
    if (!state.sold) return;
    if (state.sold.who === "You") {
      addToCart({ slug: "vase-qinghua-hand-painted", title: lot.title, image: lot.image, unitPrice: state.sold.price, qty: 1, note: "WON AT AUCTION" });
    }
    const t = setTimeout(() => {
      setState((s) => {
        const next = lots[(s.lot + 1) % lots.length];
        return { lot: s.lot + 1, bid: next.start, top: "Opening bid", secs: LOT_SECONDS, history: ["Next lot opened", `Starts at $${next.start}`, "Good luck"], sold: null };
      });
    }, 3600);
    return () => clearTimeout(t);
  }, [state.sold, addToCart, lot.title, lot.image, lots]);

  const place = useCallback(() => {
    setHolding(false);
    setState((s) => {
      if (s.sold) return s;
      const bid = s.bid + INCREMENTS[inc];
      return { ...s, bid, top: "You", secs: s.secs <= EXTEND_BELOW ? EXTEND_TO : s.secs, history: [...s.history.slice(1), `You bid $${bid}`] };
    });
  }, [inc]);

  function startHold() {
    if (state.sold) return;
    setHolding(true);
    clearTimeout(hold.current);
    hold.current = setTimeout(place, HOLD_MS);
  }

  function cancelHold() {
    clearTimeout(hold.current);
    setHolding(false);
  }

  useEffect(() => () => clearTimeout(hold.current), []);

  const next = state.bid + INCREMENTS[inc];
  const urgent = state.secs <= EXTEND_BELOW;
  const ring = 144.5;

  return (
    <div className="lg:flex lg:h-full lg:items-center lg:justify-center lg:px-6 lg:py-5">
      <div className="fixed inset-0 overflow-hidden bg-black lg:relative lg:inset-auto lg:aspect-[9/16] lg:h-full lg:max-w-full lg:rounded-[28px] lg:shadow-[0_30px_80px_rgb(0_0_0/0.5)]">
        <Image src={image} alt={`${host} showing porcelain live from the studio`} fill loading="eager" fetchPriority="high" quality={55} sizes="(min-width: 1024px) 480px, 100vw" className="object-cover motion-safe:animate-kenburns" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.5),transparent_20%,transparent_40%,rgb(0_0_0/0.85)_72%,#000)]" />

        <header className="pt-safe absolute inset-x-3 top-0 z-10 flex items-center gap-2 lg:top-3">
          <div className="glass flex h-14 items-center gap-2 rounded-full px-1.5 pr-4">
            <Image src={seller.avatar} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-full object-cover" />
            <div>
              <p className="text-sm font-bold">
                {seller.name} · {host}
              </p>
              <p className="text-[11px] text-ink-2">2,140 watching · {seller.city}</p>
            </div>
          </div>
          <Link href="/drops" aria-label="Leave auction" className="glass ml-auto grid size-11 place-items-center rounded-full">
            <Icon name="close" className="size-5" strokeWidth={2.2} />
          </Link>
        </header>
        <div className="absolute top-[calc(max(env(safe-area-inset-top),12px)+66px)] left-3 z-10 flex gap-1.5 lg:top-[78px]">
          <span className="flex h-[26px] items-center gap-1.5 rounded-full bg-live px-2.5 text-[11px] font-extrabold tracking-[0.08em]">
            <span className="size-1.5 rounded-full bg-white motion-safe:animate-blink" />
            LIVE
          </span>
          <span className="glass flex h-[26px] items-center rounded-full px-2.5 text-[11px] font-bold tracking-[0.06em]">AUCTION · LOT {state.lot + 7}</span>
        </div>

        <ul aria-live="polite" aria-label="Bids" className="absolute right-24 bottom-[calc(max(env(safe-area-inset-bottom),16px)+330px)] left-3 z-10 flex flex-col gap-1.5 [mask-image:linear-gradient(180deg,transparent,#000_40%)]">
          {state.history.map((h, i) => (
            <li key={`${h}-${i}`} className={`self-start rounded-2xl px-2.5 py-1.5 text-[13px] font-semibold ${h.startsWith("You") ? "bg-positive/25 text-positive ring-[0.5px] ring-positive/50" : "bg-black/45"}`}>
              {h}
            </li>
          ))}
        </ul>

        <section aria-label="Bid on this lot" className="glass-sheet bottom-safe absolute inset-x-2.5 z-10 flex flex-col gap-3 rounded-[32px] p-3.5">
          <div className="flex items-center gap-3">
            <Image src={lot.image} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-extrabold tracking-[0.12em] text-accent-light">STARTED AT {money(lot.start)}</p>
              <p className="truncate text-[15px] font-bold">{lot.title}</p>
              <p className="text-xs text-ink-2">Hand-painted · ships in a fitted case</p>
            </div>
            <div role="timer" aria-label={`${state.secs} seconds left`} className="relative size-14 shrink-0">
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
                  strokeDashoffset={ring * (1 - state.secs / LOT_SECONDS)}
                  className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${urgent ? "stroke-live" : "stroke-white"}`}
                />
              </svg>
              <b className="absolute inset-0 grid place-items-center text-base font-extrabold tabular-nums">{state.secs}</b>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <span key={state.bid} className="font-display text-[44px] leading-none font-extrabold tabular-nums motion-safe:animate-pop">
              {money(state.bid)}
            </span>
            <span className="text-right text-xs text-ink-2">
              {youLead ? "Top bid" : "Top bidder"}
              <b className={`block text-sm ${youLead ? "text-positive" : "text-ink"}`}>{youLead ? "You're winning" : state.top}</b>
            </span>
          </div>

          <div role="radiogroup" aria-label="Bid increment" className="grid grid-cols-3 gap-2">
            {INCREMENTS.map((step, i) => (
              <button
                key={step}
                type="button"
                role="radio"
                aria-checked={inc === i}
                onClick={() => setInc(i)}
                className={`h-11 rounded-full text-sm font-extrabold transition-colors ${inc === i ? "bg-white text-black" : "glass-inset"}`}
              >
                +{money(step)}
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
                place();
              }
            }}
            className="relative flex h-[60px] touch-none items-center justify-center overflow-hidden rounded-full bg-accent text-[17px] font-extrabold select-none"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 bg-white/30"
              style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${HOLD_MS}ms linear` : "width 0.2s" }}
            />
            <span className="relative flex items-center gap-2">
              <Icon name="gavel" className="size-5" strokeWidth={2.2} />
              {holding ? "Keep holding…" : `Hold to bid ${money(next)}`}
            </span>
          </button>
          <p className="-mt-1 text-center text-[11px] text-ink-2">Late bids add 10 s · hold to bid so a stray tap never counts</p>
        </section>

        <div role="status" className={`absolute inset-0 z-20 grid place-items-center bg-black/50 transition-opacity ${state.sold ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {state.sold && (
            <div className="glass-sheet w-[300px] rounded-[34px] p-6 text-center motion-safe:animate-pop">
              <p className="seal text-6xl text-accent-light">成交</p>
              <p className="mt-2 font-display text-2xl font-extrabold">Sold for {money(state.sold.price)}</p>
              <p className="mt-1 text-sm text-ink-2">{state.sold.who === "You" ? "It's yours. It's in your bag at the winning price." : `Won by ${state.sold.who} · next lot in a moment`}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

