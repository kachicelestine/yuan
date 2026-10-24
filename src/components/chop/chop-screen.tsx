"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import type { Chop, Product } from "@/lib/catalog";
import { chopHelpers, cutSize, priceAfter } from "@/lib/chops";
import { clock } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";

type Progress = Record<string, { mine: boolean; helpers: number }>;

// The deadline is fixed when the page first loads in this tab; it never extends.
const opened = Date.now();

/** Pinduoduo-style price chop, made fair: a fixed target, equal cuts and a deadline that never moves. */
export function ChopScreen({ chop, product, others }: { chop: Chop; product: Product; others: { chop: Chop; product: Product }[] }) {
  const money = useMoney();
  const now = useNow(1000);
  const { addToCart } = useStore();
  const [progress, setProgress] = useStored<Progress>("app.chops", {});
  const [inviting, setInviting] = useState(false);
  const [bought, setBought] = useState(false);
  const mine = progress[chop.id] ?? { mine: false, helpers: 0 };
  const helpers = chopHelpers.slice(0, mine.helpers);
  const cutters = [...chop.friends, ...(mine.mine ? [{ name: "You", avatar: "" }] : []), ...helpers].slice(0, chop.cuts);
  const done = cutters.length;
  const left = chop.cuts - done;
  const price = priceAfter(chop, product, done);
  const full = product.price ?? 0;
  const end = opened + chop.hoursLeft * 3_600_000;

  const { mine: cutMine, helpers: helperCount } = mine;

  // Demo only: invited friends answer one by one until the target is reached.
  useEffect(() => {
    if (!inviting || left <= 0) return;
    const t = setTimeout(() => setProgress({ ...progress, [chop.id]: { mine: cutMine, helpers: helperCount + 1 } }), 1400);
    return () => clearTimeout(t);
  }, [inviting, left, progress, chop.id, cutMine, helperCount, setProgress]);

  function cut() {
    setProgress({ ...progress, [chop.id]: { ...mine, mine: true } });
  }

  async function invite() {
    const url = `${window.location.origin}/chop/${chop.id}?from=you`;
    const text = `Help me chop ${product.title} down to ${money(chop.target)} on ${brand.name}. One tap, free.`;
    try {
      if (navigator.share) await navigator.share({ title: brand.name, text, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // Share sheet dismissed: still show friends arriving, as if the link went out.
    }
    setInviting(true);
  }

  function buy() {
    addToCart({ slug: product.slug, title: product.title, image: product.images[0], unitPrice: chop.target, qty: 1, note: "Chopped price" });
    setBought(true);
  }

  return (
    <div className="mx-auto max-w-[620px] px-3.5 pt-safe pb-36 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/drops" aria-label="Back to drops" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-xl font-bold">Chop the price</h1>
        <span role="timer" aria-label="Time left" className="glass-inset flex h-9 items-center gap-1.5 rounded-full px-3 font-display text-sm font-bold tabular-nums">
          <Icon name="clock" className="size-4 text-ink-2" />
          {now === null ? "--:--:--" : clock((end - now) / 1000)}
        </span>
      </header>

      <section aria-label="Your chop" className="glass relative overflow-hidden rounded-[32px] p-5 text-center">
        <span aria-hidden="true" className="absolute -top-20 left-1/2 size-[300px] -translate-x-1/2 rounded-full bg-accent/30 blur-[80px]" />
        <Link href={`/p/${product.slug}`} className="relative mx-auto block size-[150px] overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgb(0_0_0/0.45)]">
          <Image src={product.images[0]} alt="" fill loading="eager" sizes="150px" className="object-cover" />
        </Link>
        <h2 className="relative mt-4 text-[15px] font-semibold">{product.title}</h2>
        <p className="relative mt-1 flex items-baseline justify-center gap-2">
          <b key={done} className="font-display text-[48px] leading-none font-black tracking-[-0.03em] motion-safe:animate-pop">
            {money(price)}
          </b>
          {done > 0 && <s className="text-sm text-ink-3">{money(full)}</s>}
        </p>
        <p className="relative mt-1 text-[13px] text-ink-2">
          {left > 0 ? (
            <>
              <b className="text-ink">{left}</b> more {left === 1 ? "cut" : "cuts"} to reach <b className="text-save">{money(chop.target)}</b>
            </>
          ) : (
            <b className="text-positive">Chopped to the target. It&apos;s yours at {money(chop.target)}.</b>
          )}
        </p>

        <ol aria-label={`${done} of ${chop.cuts} cuts`} className="relative mt-5 flex gap-1">
          {Array.from({ length: chop.cuts }, (_, i) => {
            const who = cutters[i];
            return (
              <li key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className={`h-2 w-full rounded-full transition-colors duration-500 ${who ? "bg-gradient-to-r from-accent to-accent-light" : "bg-white/12"}`} />
                {who ? (
                  who.avatar ? (
                    <Image src={who.avatar} alt={who.name} width={28} height={28} sizes="28px" className="size-7 rounded-full object-cover ring-2 ring-surface motion-safe:animate-pop" />
                  ) : (
                    <span className="grid size-7 place-items-center rounded-full bg-white text-[10px] font-extrabold text-black motion-safe:animate-pop">You</span>
                  )
                ) : (
                  <span className="size-7 rounded-full border border-dashed border-white/25" />
                )}
              </li>
            );
          })}
        </ol>
        <p className="relative mt-2 text-xs text-ink-3">Every cut takes off the same {money(cutSize(chop, product))}</p>

        <div className="relative mt-5 flex flex-col gap-2">
          {left <= 0 ? (
            bought ? (
              <Link href="/checkout" className="flex h-[52px] items-center justify-center rounded-full bg-white text-[15px] font-bold text-black">
                In your bag · Check out
              </Link>
            ) : (
              <button type="button" onClick={buy} className="h-[52px] rounded-full bg-accent text-[15px] font-bold">
                Buy it for {money(chop.target)}
              </button>
            )
          ) : !mine.mine ? (
            <button type="button" onClick={cut} className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold">
              <Icon name="scissors" className="size-5" />
              Make your cut
            </button>
          ) : (
            <button type="button" onClick={invite} disabled={inviting} className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-black disabled:opacity-80">
              <Icon name="share" className="size-5" />
              {inviting ? "Friends are cutting…" : `Invite ${left} ${left === 1 ? "friend" : "friends"}`}
            </button>
          )}
          {left > 0 && full > 0 && (
            <Link href={`/p/${product.slug}`} className="text-[13px] font-semibold text-ink-2">
              Or buy now at {money(price)}
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
            `The target is ${money(chop.target)} and needs exactly ${chop.cuts} cuts. It never moves.`,
            "Friends cut with one tap. They don't need to buy, sign up or download anything.",
            "The clock never resets. If time runs out, nothing is charged and the normal price stays.",
          ].map((r) => (
            <li key={r} className="flex gap-2">
              <Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-positive" />
              {r}
            </li>
          ))}
        </ul>
      </section>

      {others.length > 0 && (
        <section aria-labelledby="help-h" className="mt-6">
          <h2 id="help-h" className="mb-2.5 px-1 text-[15px] font-bold">
            Friends asking for a cut
          </h2>
          <ul className="flex flex-col gap-2">
            {others.map(({ chop: c, product: p }) => {
              const lead = c.friends[0];
              return (
                <li key={c.id}>
                  <Link href={`/chop/${c.id}`} className="glass flex items-center gap-3 rounded-[22px] p-3">
                    <span className="relative shrink-0">
                      <Image src={p.images[0]} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-2xl object-cover" />
                      {lead && <Image src={lead.avatar} alt="" width={24} height={24} sizes="24px" className="absolute -right-1.5 -bottom-1.5 size-6 rounded-full object-cover ring-2 ring-surface" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {lead?.name ?? "A friend"} wants {p.title.toLowerCase()}
                      </span>
                      <span className="block text-xs text-ink-2">
                        {c.cuts - c.friends.length} cuts to {money(c.target)}
                      </span>
                    </span>
                    <span className="flex h-9 items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-bold">
                      <Icon name="scissors" className="size-3.5" />
                      Cut
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
