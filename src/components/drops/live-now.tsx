"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { clock } from "@/lib/format";
import { photo } from "@/lib/images";
import { useNow } from "@/lib/use-now";
import type { DropView } from "@/modules/engagement";
import { claimDropAction } from "@/server/actions/promos";

export type LiveDrop = DropView & { product: { title: string; image: string; price: number | null } };

/** Drops open right now: a drop price, a stock bar that's real, and each one's own end time. */
export function LiveNow({ drops }: { drops: LiveDrop[] }) {
  const now = useNow(1000);
  if (!drops.length) return null;
  return (
    <section aria-labelledby="live-now">
      <div className="relative overflow-hidden rounded-[32px]">
        <Image src={photo("1735126419093-9cf5c85320a3", { ar: "16:9", fy: 0.35 })} alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 900px, 100vw" className="object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgb(5_5_6/0.3),rgb(5_5_6/0.9))]" />
        <div className="relative p-5 pt-24">
          <p className="seal text-5xl text-save drop-shadow-[0_4px_18px_rgb(255_197_61/0.45)]" aria-hidden="true">
            夜市
          </p>
          <h2 id="live-now" className="mt-2 font-display text-[28px] font-extrabold tracking-[-0.02em]">
            Live now
          </h2>
          <p className="text-sm text-ink-2">Each deal shows when it ends. Clocks never reset, and stock bars are real.</p>
        </div>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {drops.map((d) => (
          <li key={d.id}>
            <LiveDropCard drop={d} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LiveDropCard({ drop: d, now }: { drop: LiveDrop; now: number | null }) {
  const money = useMoney();
  const router = useRouter();
  const { addToCart } = useStore();
  const [got, setGot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const claimedPct = d.stock ? Math.min(100, Math.round((d.claimed / d.stock) * 100)) : 0;
  const soldOut = d.state === "sold_out";

  const claim = () =>
    start(async () => {
      const r = await claimDropAction(d.id);
      if (!r.ok) {
        if (r.code === "sign_in_required") return router.push("/signin?next=/drops");
        return setError(r.message);
      }
      addToCart({ slug: d.slug, title: d.product.title, image: d.product.image, unitPrice: r.price, qty: 1, note: "DROP PRICE · HELD 30 MIN" });
      setGot(true);
      setError(null);
    });

  return (
    <article className="glass flex gap-3 rounded-[26px] p-2.5">
      <Link href={`/p/${d.slug}`} className="relative size-[104px] shrink-0 overflow-hidden rounded-[18px]">
        <Image src={d.product.image} alt={d.product.title} fill sizes="104px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={`/p/${d.slug}`} className="line-clamp-2 text-[14.5px] leading-tight font-bold hover:underline">
          {d.product.title}
        </Link>
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-[22px] font-extrabold text-save">{money(d.price ?? 0)}</span>
          {d.product.price !== null && <s className="text-xs text-ink-3">{money(d.product.price)}</s>}
          <span role="timer" className="ml-auto text-[11px] text-ink-2 tabular-nums">
            {now === null ? "" : `ends in ${clock((new Date(d.endsAt).getTime() - now) / 1000)}`}
          </span>
        </p>
        <div className="mt-auto flex items-center gap-2.5">
          <div className="flex-1">
            <div role="img" aria-label={`${claimedPct}% claimed`} className="h-2 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-gradient-to-r from-save to-accent" style={{ width: `${claimedPct}%` }} />
            </div>
            <span className="mt-1 block text-[10.5px] text-ink-2">
              {soldOut ? "All claimed" : `${claimedPct}% claimed`} · {d.perPerson} per person
            </span>
          </div>
          {got ? (
            <Link href="/checkout" className="flex h-11 items-center rounded-full bg-positive/15 px-4 text-[13.5px] font-extrabold text-positive">
              In bag
            </Link>
          ) : (
            <button type="button" disabled={busy || soldOut} onClick={claim} className="h-11 rounded-full bg-save px-4 text-[13.5px] font-extrabold text-black disabled:bg-white/10 disabled:text-ink-3">
              {soldOut ? "Sold out" : "Grab"}
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-[11px] font-semibold text-like">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}

/** A reminder toggle for something starting later (signing in first if needed). */
export function ReminderToggle({ on, onToggle, busy, label = "Remind me", small = false }: { on: boolean; onToggle: () => void; busy?: boolean; label?: string; small?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={busy}
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full font-bold transition-colors ${small ? "h-9 px-3 text-xs" : "h-11 px-4 text-[13px]"} ${on ? "bg-positive/15 text-positive" : small ? "glass-inset" : "bg-white text-black"}`}
    >
      <Icon name={on ? "check" : "bell"} className={small ? "size-3.5" : "size-4"} strokeWidth={2.2} />
      {on ? "Reminder set" : label}
    </button>
  );
}
