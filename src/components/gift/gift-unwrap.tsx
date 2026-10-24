"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { brand } from "@/config/brand";
import { getProduct, type Gift } from "@/lib/catalog";
import { useStore } from "@/components/providers";
import { getTheme, sampleGift } from "@/lib/gifts";
import { shiftDelivery } from "@/lib/landed";
import { useStored } from "@/lib/use-stored";

const thanks = ["❤️", "🥹", "🙏", "🎉"];

/** What the recipient sees: a wrapped box, the card, then the gift, their choice and their address. */
export function GiftUnwrap() {
  const params = useSearchParams();
  const [gifts] = useStored<Gift[]>("app.gifts", []);
  const gift = params.get("g") === "mine" && gifts.length ? gifts[gifts.length - 1] : sampleGift;
  const product = getProduct(gift.slug);
  const { markets, market: home } = useStore();
  const market = markets.find((m) => m.code === gift.market) ?? home;
  const theme = getTheme(gift.theme);
  const [stage, setStage] = useState<"wrapped" | "opening" | "card" | "gift" | "sent">("wrapped");
  const [choice, setChoice] = useState<number | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  if (!product) return null;
  const option = gift.theyChoose ? product.options?.[0] : undefined;

  function unwrap() {
    setStage("opening");
    setTimeout(() => setStage("card"), 700);
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[520px] flex-col items-center px-5 pt-safe pb-36 text-center lg:pb-16">
      <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-40 blur-[90px] ${theme.bg}`} />

      <header className="relative mt-6 flex flex-col items-center gap-2">
        {gift.avatar ? (
          <Image src={gift.avatar} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-full object-cover ring-2 ring-white/30" />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-white/15 font-display text-lg font-bold">{gift.from[0]}</span>
        )}
        <p className="text-[15px] text-ink-2">
          <b className="text-ink">{gift.from === "You" ? "You" : gift.from}</b> sent {gift.to} a gift
        </p>
      </header>

      {(stage === "wrapped" || stage === "opening") && (
        <button type="button" onClick={unwrap} disabled={stage === "opening"} aria-label="Unwrap the gift" className="relative mt-10 flex flex-col items-center gap-6">
          <span className={`relative block size-[230px] ${stage === "wrapped" ? "motion-safe:animate-breathe" : ""}`}>
            <span className={`absolute inset-x-0 bottom-0 h-[78%] rounded-[30px] shadow-[0_30px_70px_rgb(0_0_0/0.5)] ${theme.bg}`} />
            <span className="absolute bottom-0 left-1/2 h-[78%] w-7 -translate-x-1/2 bg-save/90" />
            <span className={`absolute inset-x-[-10px] top-[14%] h-[18%] rounded-[18px] shadow-[0_10px_24px_rgb(0_0_0/0.35)] ${theme.bg} ${stage === "opening" ? "motion-safe:animate-lid" : ""}`}>
              <span className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 bg-save" />
              <span className="absolute -top-9 left-1/2 flex -translate-x-1/2 gap-1">
                <span className="h-10 w-12 -rotate-[24deg] rounded-[50%_50%_10%_50%] border-[7px] border-save" />
                <span className="h-10 w-12 rotate-[24deg] rounded-[50%_50%_50%_10%] border-[7px] border-save" />
              </span>
            </span>
          </span>
          <span className="glass flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-bold">
            <Icon name="gift" className="size-5" />
            Tap to unwrap
          </span>
        </button>
      )}

      {stage === "card" && (
        <div className="relative mt-8 flex w-full flex-col items-center gap-5">
          <article className={`relative w-full overflow-hidden rounded-[30px] p-6 text-left shadow-[0_30px_70px_rgb(0_0_0/0.45)] motion-safe:animate-reveal ${theme.bg}`}>
            <span aria-hidden="true" className="seal absolute -right-3 -bottom-6 text-[120px] leading-none text-white/15">
              {theme.seal}
            </span>
            <p className="text-xs font-bold tracking-[0.12em] text-white/75">{theme.label.toUpperCase()}</p>
            <p className="mt-3 font-display text-[28px] leading-tight font-extrabold">Dear {gift.to},</p>
            <p className="mt-2 text-[17px] leading-relaxed text-white/95">{gift.message || "Something small to say I'm thinking of you."}</p>
            <p className="mt-4 text-sm font-semibold text-white/85">{gift.from === "You" ? "From me" : `Love, ${gift.from}`}</p>
          </article>
          <button type="button" onClick={() => setStage("gift")} className="h-12 w-full rounded-full bg-white text-[15px] font-bold text-black">
            See your gift
          </button>
        </div>
      )}

      {(stage === "gift" || stage === "sent") && (
        <div className="relative mt-8 flex w-full flex-col items-center gap-4">
          <div className="relative aspect-square w-[240px] overflow-hidden rounded-[32px] shadow-[0_30px_70px_rgb(0_0_0/0.5)] motion-safe:animate-reveal">
            <Image src={product.images[0]} alt={product.title} fill sizes="240px" className="object-cover" />
          </div>
          <div>
            <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{product.title}</h1>
            <p className="mt-1 text-sm text-ink-2">{gift.hidePrice ? "Price hidden by the sender" : null}{gift.wrap ? " · Gift-wrapped with a printed card" : ""}</p>
          </div>

          {stage === "gift" ? (
            <div className="glass w-full rounded-[26px] p-4 text-left">
              {option && (
                <fieldset className="mb-4">
                  <legend className="mb-2 text-[13px] font-semibold text-ink-2">Pick your {option.name.toLowerCase()}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {option.values.map((v, i) => (
                      <button key={v.label} type="button" aria-pressed={choice === i} onClick={() => setChoice(i)} className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors ${choice === i ? "bg-white text-black" : "glass-inset"}`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                <Flag code={market.code} className="size-4" />
                Where should it go?
              </p>
              <div className="flex flex-col gap-2">
                <input aria-label="Full name" defaultValue={gift.to} className="glass-inset h-12 rounded-2xl px-4 text-[15px] outline-none focus:ring-2 focus:ring-white/40" />
                <input aria-label="Street address" placeholder="Street address" className="glass-inset h-12 rounded-2xl px-4 text-[15px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-white/40" />
                <input aria-label="City" defaultValue={market.city} className="glass-inset h-12 rounded-2xl px-4 text-[15px] outline-none focus:ring-2 focus:ring-white/40" />
              </div>
              <button type="button" disabled={!!option && choice === null} onClick={() => setStage("sent")} className="mt-4 h-12 w-full rounded-full bg-accent text-[15px] font-bold disabled:opacity-40">
                {option && choice === null ? `Pick a ${option.name.toLowerCase()} first` : "Send it to me"}
              </button>
              <p className="mt-2 text-center text-xs text-ink-3">Duties are paid. Nothing to pay at the door.</p>
            </div>
          ) : (
            <div className="glass w-full rounded-[26px] p-4">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-positive/15 text-positive">
                <Icon name="truck" className="size-6" />
              </span>
              <h2 className="mt-2 font-display text-lg font-bold">On its way to {market.city}</h2>
              <p className="text-[13px] text-ink-2">
                Arriving {shiftDelivery(product.delivery, market.extraDays)}
                {option && choice !== null ? ` · ${option.name}: ${option.values[choice].label}` : ""}
              </p>
              <p className="mt-4 text-[13px] font-semibold text-ink-2">Say thanks to {gift.from === "You" ? "the sender" : gift.from}</p>
              <div className="mt-2 flex justify-center gap-2">
                {thanks.map((t) => (
                  <button key={t} type="button" aria-pressed={said === t} onClick={() => setSaid(t)} className={`grid size-12 place-items-center rounded-full text-2xl transition-transform ${said === t ? "scale-110 bg-white/20" : "glass-inset"}`}>
                    {t}
                  </button>
                ))}
              </div>
              {said && (
                <p role="status" className="mt-2 text-xs text-positive">
                  Sent {said} to {gift.from === "You" ? "the sender" : gift.from}
                </p>
              )}
              <Link href="/" className="mt-4 block text-[13px] font-semibold text-agent">
                Explore {brand.name}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
