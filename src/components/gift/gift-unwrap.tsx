"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { getTheme } from "@/lib/gifts";
import { shiftDelivery } from "@/lib/landed";
import { addressRules, GIFT_THANKS, type GiftView } from "@/modules/ordering";
import { claimGiftAction, thankGiftAction } from "@/server/actions/gifts";

type Stage = "wrapped" | "opening" | "card" | "gift" | "sent";

/** What the recipient sees: a wrapped box, the card, then the gift, their pick and their address. */
export function GiftUnwrap({ initial, choices, delivery }: { initial: GiftView; choices: string[]; delivery: string | null }) {
  const money = useMoney();
  const { markets } = useStore();
  const [gift, setGift] = useState(initial);
  const market = markets.find((m) => m.code === gift.country);
  const theme = getTheme(gift.theme);
  const [stage, setStage] = useState<Stage>("wrapped");
  const [choice, setChoice] = useState<string | null>(null);
  const [address, setAddress] = useState({ name: gift.recipientName, phone: "", line1: "", line2: "", city: market?.city ?? "", region: "", postcode: "" });
  const rules = addressRules(gift.country);
  const [said, setSaid] = useState<string | null>(gift.thanks);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const waiting = gift.state === "waiting";

  function unwrap() {
    setStage("opening");
    setTimeout(() => setStage("card"), 700);
  }

  if (gift.state === "unpaid" || gift.state === "cancelled") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-3 px-5 text-center">
        <Icon name="gift" className="size-10 text-ink-2" />
        <h1 className="font-display text-2xl font-bold">{gift.state === "unpaid" ? "Almost ready" : "This gift was cancelled"}</h1>
        <p className="text-sm text-ink-2">{gift.state === "unpaid" ? `${gift.fromName} hasn't finished paying for it yet. Open this link again in a little while.` : `Ask ${gift.fromName} about it.`}</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[520px] flex-col items-center px-5 pt-safe pb-36 text-center lg:pb-16">
      <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-40 blur-[90px] ${theme.bg}`} />

      <header className="relative mt-6 flex flex-col items-center gap-2">
        <span className="grid size-14 place-items-center rounded-full bg-white/15 font-display text-lg font-bold">{gift.fromName[0]?.toUpperCase()}</span>
        <p className="text-[15px] text-ink-2">
          <b className="text-ink">{gift.fromName}</b> sent {gift.recipientName} a gift
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
            <p className="mt-3 font-display text-[28px] leading-tight font-extrabold">Dear {gift.recipientName},</p>
            <p className="mt-2 text-[17px] leading-relaxed whitespace-pre-line text-white/95">{gift.message || "Something small to say I'm thinking of you."}</p>
            <p className="mt-4 text-sm font-semibold text-white/85">Love, {gift.fromName}</p>
          </article>
          <button type="button" onClick={() => setStage(waiting ? "gift" : "sent")} className="h-12 w-full rounded-full bg-white text-[15px] font-bold text-black">
            See your gift
          </button>
        </div>
      )}

      {(stage === "gift" || stage === "sent") && (
        <div className="relative mt-8 flex w-full flex-col items-center gap-4">
          <div className="relative aspect-square w-[240px] overflow-hidden rounded-[32px] shadow-[0_30px_70px_rgb(0_0_0/0.5)] motion-safe:animate-reveal">
            <Image src={gift.image} alt={gift.title} fill priority sizes="240px" className="object-cover" />
          </div>
          <div>
            <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{gift.title}</h1>
            <p className="mt-1 text-sm text-ink-2">
              {gift.price === null ? "The price is a secret" : money(gift.price)}
              {gift.option ? ` · ${gift.option}` : ""}
            </p>
          </div>

          {stage === "gift" && waiting ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (busy) return;
                setError(null);
                start(async () => {
                  const r = await claimGiftAction(gift.token, address, choice);
                  if (!r.ok) return setError(r.message);
                  setGift(r.gift);
                  setStage("sent");
                });
              }}
              className="glass w-full rounded-[26px] p-4 text-left"
            >
              {gift.chooseOption && (
                <fieldset className="mb-4">
                  <legend className="mb-2 text-[13px] font-semibold text-ink-2">Pick your {gift.chooseOption.toLowerCase()}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {choices.map((v) => (
                      <button key={v} type="button" aria-pressed={choice === v} onClick={() => setChoice(v)} className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors ${choice === v ? "bg-white text-black" : "glass-inset"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                <Flag code={gift.country} className="size-4" />
                Where should it go{market ? ` in ${market.name}` : ""}?
              </p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    ["name", "Full name", "name"],
                    ["phone", "Phone, for the courier", "tel"],
                    ["line1", "Street and number", "address-line1"],
                    ["line2", "Apartment or landmark (optional)", "address-line2"],
                    ["city", "City", "address-level2"],
                    ["region", rules.region.required ? rules.region.label : `${rules.region.label} (optional)`, "address-level1"],
                    ["postcode", rules.postcode.required ? rules.postcode.label : `${rules.postcode.label} (optional)`, "postal-code"],
                  ] as const
                ).map(([key, label, auto]) => (
                  <input
                    key={key}
                    aria-label={label}
                    placeholder={label}
                    autoComplete={auto}
                    type={key === "phone" ? "tel" : "text"}
                    required={key === "region" ? rules.region.required : key === "postcode" ? rules.postcode.required : key !== "line2"}
                    value={address[key]}
                    onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
                    className="glass-inset h-12 rounded-2xl px-4 text-[15px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-white/40"
                  />
                ))}
              </div>
              {error && (
                <p role="alert" className="mt-3 text-[13px] text-like">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy || (!!gift.chooseOption && choice === null)} className="mt-4 h-12 w-full rounded-full bg-accent text-[15px] font-bold disabled:opacity-40">
                {busy ? "Sending…" : gift.chooseOption && choice === null ? `Pick a ${gift.chooseOption.toLowerCase()} first` : "Send it to me"}
              </button>
              <p className="mt-2 text-center text-xs text-ink-3">Duties are paid. Nothing to pay at the door. Only the shop sees your address.</p>
            </form>
          ) : (
            <div className="glass w-full rounded-[26px] p-4">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-positive/15 text-positive">
                <Icon name="truck" className="size-6" />
              </span>
              <h2 className="mt-2 font-display text-lg font-bold">On its way{market ? ` to ${market.name}` : ""}</h2>
              <p className="text-[13px] text-ink-2">
                {delivery && market ? `Usually arrives ${shiftDelivery(delivery, market.extraDays)}` : "The shop ships it next."}
                {gift.chooseOption && gift.choice ? ` · ${gift.chooseOption}: ${gift.choice}` : ""}
              </p>
              <p className="mt-4 text-[13px] font-semibold text-ink-2">Say thanks to {gift.fromName}</p>
              <div className="mt-2 flex justify-center gap-2">
                {GIFT_THANKS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={said === t}
                    onClick={() =>
                      start(async () => {
                        const r = await thankGiftAction(gift.token, t);
                        if (r.ok) setSaid(t);
                      })
                    }
                    className={`grid size-12 place-items-center rounded-full text-2xl transition-transform ${said === t ? "scale-110 bg-white/20" : "glass-inset"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {said && (
                <p role="status" className="mt-2 text-xs text-positive">
                  Sent {said} to {gift.fromName}
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
