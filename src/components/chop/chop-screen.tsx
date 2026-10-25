"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { clock } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import type { ChopOfferView, ChopView } from "@/modules/engagement";
import { cutChopAction, startChopAction } from "@/server/actions/chops";

type ProductInfo = { slug: string; title: string; image: string };

/** Starts a chop on an offer and opens it (signing in first if needed). */
export function useStartChop() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (offerId: string) =>
    start(async () => {
      const r = await startChopAction(offerId);
      if (r.ok) return router.push(`/chop/${r.id}`);
      if (r.code === "sign_in_required") return router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
      setError(r.message);
    });
  return { start: run, busy, error };
}

/** Pinduoduo-style price chop, made fair: a fixed target, equal cuts and a deadline that never moves. */
export function ChopScreen({ initial, product, offers }: { initial: ChopView; product: ProductInfo; offers: { offer: ChopOfferView; product: ProductInfo }[] }) {
  const money = useMoney();
  const now = useNow(1000);
  const { addToCart } = useStore();
  const [chop, setChop] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bought, setBought] = useState(false);
  const [busy, start] = useTransition();
  const starter = useStartChop();

  // Cuts arrive while it's open: refresh every few seconds while the page is visible.
  useEffect(() => {
    if (chop.status !== "open") return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/chops/${chop.id}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<ChopView>) : null))
        .then((c) => c && setChop(c))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [chop.id, chop.status]);

  const left = chop.cuts - chop.done;
  const msLeft = now === null ? null : new Date(chop.endsAt).getTime() - now;
  const status = chop.status === "open" && msLeft !== null && msLeft <= 0 ? "expired" : chop.status;

  const cut = () =>
    start(async () => {
      const r = await cutChopAction(chop.id);
      if (!r.ok) return setError(r.message);
      setError(null);
      setChop(r.chop);
    });

  async function invite() {
    const url = `${window.location.origin}/chop/${chop.id}`;
    const text = `Help me chop ${product.title} down to ${money(chop.target)} on ${brand.name}. One tap, free.`;
    try {
      if (navigator.share) await navigator.share({ title: brand.name, text, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Dismissed.
    }
  }

  function buy() {
    addToCart({ slug: product.slug, title: product.title, image: product.image, unitPrice: chop.target, qty: 1, note: "Chopped price" });
    setBought(true);
  }

  return (
    <div className="mx-auto max-w-[620px] px-3.5 pt-safe pb-36 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/drops" aria-label="Back to drops" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-xl font-bold">Chop the price</h1>
        {status === "open" && (
          <span role="timer" aria-label="Time left" className="glass-inset flex h-9 items-center gap-1.5 rounded-full px-3 font-display text-sm font-bold tabular-nums">
            <Icon name="clock" className="size-4 text-ink-2" />
            {msLeft === null ? "--:--:--" : clock(msLeft / 1000)}
          </span>
        )}
      </header>

      <section aria-label={chop.yours ? "Your chop" : `${chop.ownerName}'s chop`} className="glass relative overflow-hidden rounded-[32px] p-5 text-center">
        <span aria-hidden="true" className="absolute -top-20 left-1/2 size-[300px] -translate-x-1/2 rounded-full bg-accent/30 blur-[80px]" />
        {!chop.yours && <p className="relative mb-3 text-[13px] text-ink-2">{chop.ownerName} asked you for a cut</p>}
        <Link href={`/p/${product.slug}`} className="relative mx-auto block size-[150px] overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgb(0_0_0/0.45)]">
          <Image src={product.image} alt="" fill loading="eager" sizes="150px" className="object-cover" />
        </Link>
        <h2 className="relative mt-4 text-[15px] font-semibold">{product.title}</h2>
        <p className="relative mt-1 flex items-baseline justify-center gap-2">
          <b key={chop.done} className="font-display text-[48px] leading-none font-black tracking-[-0.03em] motion-safe:animate-pop">
            {money(chop.price)}
          </b>
          {chop.done > 0 && <s className="text-sm text-ink-3">{money(chop.fullPrice)}</s>}
        </p>
        <p className="relative mt-1 text-[13px] text-ink-2">
          {status === "open" ? (
            <>
              <b className="text-ink">{left}</b> more {left === 1 ? "cut" : "cuts"} to reach <b className="text-save">{money(chop.target)}</b>
            </>
          ) : status === "done" ? (
            <b className="text-positive">Chopped to the target{chop.yours ? `. It's yours at ${money(chop.target)}.` : "."}</b>
          ) : status === "used" ? (
            <b className="text-positive">Chopped and bought.</b>
          ) : (
            <>Time ran out before the last cut. Nothing was charged.</>
          )}
        </p>

        <ol aria-label={`${chop.done} of ${chop.cuts} cuts`} className="relative mt-5 flex gap-1">
          {Array.from({ length: chop.cuts }, (_, i) => {
            const who = chop.cutters[i];
            return (
              <li key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className={`h-2 w-full rounded-full transition-colors duration-500 ${who ? "bg-gradient-to-r from-accent to-accent-light" : "bg-white/12"}`} />
                {who ? (
                  <span title={who} className="grid size-7 place-items-center rounded-full bg-white text-[11px] font-extrabold text-black motion-safe:animate-pop">
                    {who[0]?.toUpperCase()}
                  </span>
                ) : (
                  <span className="size-7 rounded-full border border-dashed border-white/25" />
                )}
              </li>
            );
          })}
        </ol>
        <p className="relative mt-2 text-xs text-ink-3">Every cut takes off the same {money(chop.cutSize)}</p>

        <div className="relative mt-5 flex flex-col gap-2">
          {chop.yours && status === "done" ? (
            bought ? (
              <Link href="/checkout" className="flex h-[52px] items-center justify-center rounded-full bg-white text-[15px] font-bold text-black">
                In your bag · Check out
              </Link>
            ) : (
              <button type="button" onClick={buy} className="h-[52px] rounded-full bg-accent text-[15px] font-bold">
                Buy it for {money(chop.target)}
              </button>
            )
          ) : chop.yours && status === "open" ? (
            <button type="button" onClick={invite} className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-black">
              <Icon name="share" className="size-5" />
              {copied ? "Link copied: send it to friends" : `Invite ${left} ${left === 1 ? "friend" : "friends"}`}
            </button>
          ) : !chop.yours && status === "open" && !chop.youCut ? (
            <button type="button" onClick={cut} disabled={busy} className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold disabled:opacity-60">
              <Icon name="scissors" className="size-5" />
              Cut it for {chop.ownerName}
            </button>
          ) : !chop.yours && chop.youCut ? (
            <p className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-positive/15 text-[15px] font-bold text-positive">
              <Icon name="check" className="size-5" />
              You made your cut. Thanks!
            </p>
          ) : null}
          {chop.yours && status === "done" && chop.holdsUntil && (
            <p className="text-xs text-ink-2">The chopped price holds until {new Date(chop.holdsUntil).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.</p>
          )}
          {error && (
            <p role="alert" className="text-xs font-semibold text-like">
              {error}
            </p>
          )}
          {status === "open" && (
            <Link href={`/p/${product.slug}`} className="text-[13px] font-semibold text-ink-2">
              Or buy it now at {money(chop.fullPrice)}
            </Link>
          )}
        </div>
      </section>

      <section aria-labelledby="rules-h" className="glass-inset mt-4 rounded-[24px] p-4">
        <h2 id="rules-h" className="flex items-center gap-1.5 text-[13px] font-bold">
          <Icon name="shield" className="size-4 text-positive" />
          Fair chop rules
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
          {[
            `The target is ${money(chop.target)} and needs exactly ${chop.cuts} cuts, the first one yours. It never moves.`,
            "Friends cut with one tap. They don't need to buy, sign up or download anything.",
            "The clock never resets. If time runs out, nothing is charged and the normal price stays.",
            "At the target, the price holds for 48 hours for one item.",
          ].map((r) => (
            <li key={r} className="flex gap-2">
              <Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-positive" />
              {r}
            </li>
          ))}
        </ul>
      </section>

      {offers.length > 0 && (
        <section aria-labelledby="more-h" className="mt-6">
          <h2 id="more-h" className="mb-2.5 px-1 text-[15px] font-bold">
            Start your own chop
          </h2>
          {starter.error && (
            <p role="alert" className="mb-2 px-1 text-xs font-semibold text-like">
              {starter.error}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {offers.map(({ offer: o, product: p }) => (
              <li key={o.id}>
                <button type="button" disabled={starter.busy} onClick={() => starter.start(o.id)} className="glass flex w-full items-center gap-3 rounded-[22px] p-3 text-left">
                  <Image src={p.image} alt="" width={52} height={52} sizes="52px" className="size-[52px] shrink-0 rounded-2xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-ink-2">
                      {money(o.fullPrice)} → <b className="text-save">{money(o.target)}</b> with {o.cuts} cuts
                    </span>
                  </span>
                  <span className="flex h-9 items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-bold">
                    <Icon name="scissors" className="size-3.5" />
                    Start
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
