"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { getProduct, type Drop, type DropKind } from "@/lib/catalog";
import { countdown, festival, festivalAt, localParts, upcomingDrops } from "@/lib/drops";
import { compact } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";

const kinds: Record<DropKind, { label: string; tone: string }> = {
  drop: { label: "DROP", tone: "bg-accent-light/20 text-accent-light" },
  restock: { label: "RESTOCK", tone: "bg-positive/15 text-positive" },
  preorder: { label: "PRE-ORDER", tone: "bg-series/20 text-[#7db4ff]" },
  presale: { label: "11.11 PRE-SALE", tone: "bg-save/15 text-save" },
};

/** What's coming: an 11.11 countdown, a day strip, and every drop in the shopper's own time zone. */
export function DropsCalendar() {
  const now = useNow(30_000);
  const { market } = useStore();
  const [day, setDay] = useState<string | null>(null);
  const [reminders, setReminders] = useStored<string[]>("app.reminders", []);
  const remind = (id: string) => setReminders(reminders.includes(id) ? reminders.filter((r) => r !== id) : [...reminders, id]);

  if (now === null) {
    return (
      <section aria-label="Coming up" className="flex flex-col gap-3">
        <div className="skeleton h-[220px] rounded-[32px]" />
        <div className="skeleton h-16 rounded-[22px]" />
      </section>
    );
  }

  const list = upcomingDrops(now).map((d) => ({ ...d, local: localParts(d.at, market.timeZone) }));
  const here = localParts(now, market.timeZone);
  const today = here.key;
  // Step from local noon, so a daylight-saving change can't land two steps on the same date.
  const [h, m] = here.time.split(":").map(Number);
  const noon = now + (12 * 60 - (h * 60 + m)) * 60_000;
  const days = Array.from({ length: 14 }, (_, i) => localParts(noon + i * 86_400_000, market.timeZone));
  const shown = day ? list.filter((d) => d.local.key === day) : list;
  const groups = [...new Set(shown.map((d) => d.local.key))];

  return (
    <section aria-labelledby="coming-up" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="coming-up" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
            Coming up
          </h2>
          <p className="text-sm text-ink-2">Every time shown for {market.city}. Set a reminder and we&apos;ll ping you 10 minutes before.</p>
        </div>
      </div>

      <Festival now={now} reminded={reminders.includes("1111")} onRemind={() => remind("1111")} />

      <div role="group" aria-label="Pick a day" className="no-scrollbar -mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 lg:mx-0 lg:px-0">
        <button
          type="button"
          aria-pressed={day === null}
          onClick={() => setDay(null)}
          className={`flex h-[62px] shrink-0 items-center rounded-[18px] px-4 text-[13px] font-bold transition-colors ${day === null ? "bg-white text-black" : "glass-inset text-ink-2"}`}
        >
          All
        </button>
        {days.map((d) => {
          const count = list.filter((x) => x.local.key === d.key).length;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={day === d.key}
              aria-label={`${d.weekday} ${d.day} ${d.month}, ${count} drops`}
              onClick={() => setDay(day === d.key ? null : d.key)}
              disabled={count === 0}
              className={`flex h-[62px] w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[18px] transition-colors disabled:opacity-40 ${day === d.key ? "bg-white text-black" : "glass-inset"}`}
            >
              <span className={`text-[10.5px] font-semibold ${day === d.key ? "text-black/60" : "text-ink-3"}`}>{d.key === today ? "Today" : d.weekday}</span>
              <span className="font-display text-lg leading-none font-bold">{d.day}</span>
              <span className={`size-1 rounded-full ${count ? (day === d.key ? "bg-accent" : "bg-accent-light") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      {groups.map((key) => {
        const items = shown.filter((d) => d.local.key === key);
        const first = items[0].local;
        const tomorrow = days[1].key;
        return (
          <div key={key}>
            <h3 className="mb-2 px-1 text-[13px] font-bold text-ink-2">
              {key === today ? "Today" : key === tomorrow ? "Tomorrow" : first.weekday} · {first.day} {first.month}
            </h3>
            <ul className="grid gap-2.5 lg:grid-cols-2">
              {items.map(({ drop, at, local }) => (
                <li key={drop.id}>
                  <DropCard drop={drop} at={at} now={now} time={local.time} reminded={reminders.includes(drop.id)} onRemind={() => remind(drop.id)} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Festival({ now, reminded, onRemind }: { now: number; reminded: boolean; onRemind: () => void }) {
  const left = festivalAt(now) - now;
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  return (
    <article className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(120%_90%_at_10%_0%,#ff7a52_0%,#cc3a17_38%,#3d0d05_100%)] p-5 ring-1 ring-white/15">
      <span aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-10 font-display text-[150px] leading-none font-black tracking-[-0.08em] text-white/10 select-none">
        11.11
      </span>
      <p className="text-[11px] font-extrabold tracking-[0.14em] text-save">{left > 0 ? "COUNTDOWN" : "HAPPENING NOW"}</p>
      <h3 className="mt-1 max-w-[16ch] font-display text-[26px] leading-[1.05] font-extrabold tracking-[-0.02em]">{festival.title}</h3>
      {left > 0 && (
        <p role="timer" className="mt-3 flex items-baseline gap-1 font-display tabular-nums">
          <b className="text-[44px] leading-none font-black">{days}</b>
          <span className="mr-2 text-sm font-semibold text-white/75">days</span>
          <b className="text-[44px] leading-none font-black">{hours}</b>
          <span className="text-sm font-semibold text-white/75">hours</span>
        </p>
      )}
      <ul className="relative mt-3 flex flex-wrap gap-1.5">
        {festival.perks.map((p) => (
          <li key={p} className="rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/20">
            {p}
          </li>
        ))}
      </ul>
      <button
        type="button"
        aria-pressed={reminded}
        onClick={onRemind}
        className={`relative mt-4 flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors ${reminded ? "bg-black/30 text-white ring-1 ring-white/30" : "bg-white text-black"}`}
      >
        <Icon name={reminded ? "check" : "bell"} className="size-4" strokeWidth={2.2} />
        {reminded ? "Reminder set" : "Remind me at midnight"}
      </button>
    </article>
  );
}

function DropCard({ drop, at, now, time, reminded, onRemind }: { drop: Drop; at: number; now: number; time: string; reminded: boolean; onRemind: () => void }) {
  const money = useMoney();
  const { market, addToCart } = useStore();
  const [paid, setPaid] = useState(false);
  const product = getProduct(drop.slug);
  if (!product) return null;
  const kind = kinds[drop.kind];
  const beijing = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);

  function payDeposit() {
    if (!drop.deposit || !product) return;
    addToCart({
      slug: product.slug,
      title: `${product.title} (deposit)`,
      image: product.images[0],
      unitPrice: drop.deposit.pay,
      qty: 1,
      note: drop.kind === "presale" ? `Counts as ${money(drop.deposit.worth, { nice: true })} on 11.11` : `Pre-order · ${drop.ships}`,
    });
    setPaid(true);
  }

  return (
    <article className="glass flex h-full gap-3 rounded-[24px] p-3">
      <Link href={`/p/${product.slug}`} className="relative size-[92px] shrink-0 overflow-hidden rounded-[18px]">
        <Image src={product.images[0]} alt="" fill sizes="92px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.06em]">
          <span className={`rounded-full px-1.5 py-px ${kind.tone}`}>{kind.label}</span>
          <span className="text-ink-3">{countdown(at - now).toUpperCase()}</span>
        </p>
        <h4 className="mt-1 text-[14.5px] leading-snug font-bold">{drop.title}</h4>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-2">{drop.blurb}</p>
        <p className="mt-1.5 text-[11.5px] text-ink-3">
          <b className="font-semibold text-ink">{time}</b> in {market.city} · {beijing} Beijing · {compact(drop.waiting)} waiting
        </p>
        {drop.limit && <p className="text-[11.5px] text-ink-3">{drop.limit}</p>}
        {drop.deposit && (
          <p className="mt-1.5 rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-xs">
            Pay <b className="font-bold">{money(drop.deposit.pay, { nice: true })}</b> now
            {drop.deposit.worth > drop.deposit.pay ? (
              <>
                , worth <b className="font-bold text-save">{money(drop.deposit.worth, { nice: true })}</b> off on 11.11
              </>
            ) : (
              <>, the rest when it ships · {drop.ships}</>
            )}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={reminded}
            onClick={onRemind}
            className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors ${reminded ? "bg-positive/15 text-positive" : "glass-inset"}`}
          >
            <Icon name={reminded ? "check" : "bell"} className="size-3.5" strokeWidth={2.2} />
            {reminded ? "Reminder set" : "Remind me"}
          </button>
          {drop.deposit &&
            (paid ? (
              <Link href="/checkout" className="flex h-9 items-center rounded-full bg-white px-3 text-xs font-bold text-black">
                In your bag · Pay now
              </Link>
            ) : (
              <button type="button" onClick={payDeposit} className="h-9 rounded-full bg-accent px-3 text-xs font-bold">
                {drop.kind === "presale" ? "Lock in the deposit" : "Reserve one"}
              </button>
            ))}
          {!drop.deposit && product.price !== undefined && <span className="ml-auto font-display text-sm font-bold">{money(product.price)}</span>}
        </div>
      </div>
    </article>
  );
}
