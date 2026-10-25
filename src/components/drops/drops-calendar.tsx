"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { countdown, localParts } from "@/lib/drops";
import { compact } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import type { DropKind, DropView } from "@/modules/engagement";
import { remindDropAction, remindFestivalAction } from "@/server/actions/promos";
import { ReminderToggle } from "./live-now";

export type UpcomingDrop = DropView & { product: { title: string; image: string; price: number | null } };

const kinds: Record<DropKind, { label: string; tone: string }> = {
  drop: { label: "DROP", tone: "bg-accent-light/20 text-accent-light" },
  restock: { label: "RESTOCK", tone: "bg-positive/15 text-positive" },
};

/** Sets or clears a reminder, signing in first when needed; returns the toggle's state. */
function useReminder(initial: boolean, save: (on: boolean) => Promise<{ ok: true; on: boolean } | { ok: false; code: string; message: string }>) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const r = await save(!on);
      if (r.ok) return setOn(r.on);
      if (r.code === "sign_in_required") router.push("/signin?next=/drops");
    });
  return { on, busy, toggle };
}

/** What's coming: an 11.11 countdown, a day strip, and every drop in the shopper's own time zone. */
export function DropsCalendar({ drops, festival }: { drops: UpcomingDrop[]; festival: { at: string; reminded: boolean } }) {
  const now = useNow(30_000);
  const { market } = useStore();
  const [day, setDay] = useState<string | null>(null);

  if (now === null) {
    return (
      <section aria-label="Coming up" className="flex flex-col gap-3">
        <div className="skeleton h-[220px] rounded-[32px]" />
        <div className="skeleton h-16 rounded-[22px]" />
      </section>
    );
  }

  const list = drops.map((d) => ({ drop: d, at: new Date(d.startsAt).getTime(), local: localParts(new Date(d.startsAt).getTime(), market.timeZone) }));
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
      <div>
        <h2 id="coming-up" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          Coming up
        </h2>
        <p className="text-sm text-ink-2">Every time shown for {market.city}. Set a reminder and we&apos;ll ping you 10 minutes before.</p>
      </div>

      <Festival now={now} at={new Date(festival.at).getTime()} reminded={festival.reminded} />

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

      {list.length === 0 && <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No drops scheduled yet. Shops announce them here first.</p>}

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
                  <DropCard drop={drop} at={at} now={now} time={local.time} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Festival({ now, at, reminded }: { now: number; at: number; reminded: boolean }) {
  const reminder = useReminder(reminded, remindFestivalAction);
  const left = at - now;
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  return (
    <article className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(120%_90%_at_10%_0%,#ff7a52_0%,#cc3a17_38%,#3d0d05_100%)] p-5 ring-1 ring-white/15">
      <span aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-10 font-display text-[150px] leading-none font-black tracking-[-0.08em] text-white/10 select-none">
        11.11
      </span>
      <p className="text-[11px] font-extrabold tracking-[0.14em] text-save">{left > 0 ? "COUNTDOWN" : "HAPPENING NOW"}</p>
      <h3 className="mt-1 max-w-[16ch] font-display text-[26px] leading-[1.05] font-extrabold tracking-[-0.02em]">11.11 Global Shopping Festival</h3>
      {left > 0 && (
        <p role="timer" className="mt-3 flex items-baseline gap-1 font-display tabular-nums">
          <b className="text-[44px] leading-none font-black">{days}</b>
          <span className="mr-2 text-sm font-semibold text-white/75">days</span>
          <b className="text-[44px] leading-none font-black">{hours}</b>
          <span className="text-sm font-semibold text-white/75">hours</span>
        </p>
      )}
      <p className="relative mt-2 max-w-[36ch] text-sm text-white/80">Shops save their biggest drops for midnight in Beijing. Every one is in the calendar below as it&apos;s announced.</p>
      {left > 0 && (
        <div className="relative mt-4">
          <ReminderToggle on={reminder.on} busy={reminder.busy} onToggle={reminder.toggle} label="Remind me at midnight" />
        </div>
      )}
    </article>
  );
}

function DropCard({ drop, at, now, time }: { drop: UpcomingDrop; at: number; now: number; time: string }) {
  const money = useMoney();
  const { market } = useStore();
  const reminder = useReminder(drop.reminded, (on) => remindDropAction(drop.id, on));
  const kind = kinds[drop.kind];
  const beijing = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  const waiting = drop.waiting + (reminder.on && !drop.reminded ? 1 : 0) - (!reminder.on && drop.reminded ? 1 : 0);

  return (
    <article className="glass flex h-full gap-3 rounded-[24px] p-3">
      <Link href={`/p/${drop.slug}`} className="relative size-[92px] shrink-0 overflow-hidden rounded-[18px]">
        <Image src={drop.product.image} alt="" fill sizes="92px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.06em]">
          <span className={`rounded-full px-1.5 py-px ${kind.tone}`}>{kind.label}</span>
          <span className="text-ink-3">{countdown(at - now).toUpperCase()}</span>
        </p>
        <h4 className="mt-1 text-[14.5px] leading-snug font-bold">{drop.title}</h4>
        {drop.blurb && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-2">{drop.blurb}</p>}
        <p className="mt-1.5 text-[11.5px] text-ink-3">
          <b className="font-semibold text-ink">{time}</b> in {market.city} · {beijing} Beijing{waiting > 0 && ` · ${compact(waiting)} waiting`}
        </p>
        {drop.stock !== null && (
          <p className="text-[11.5px] text-ink-3">
            {compact(drop.stock)} at the drop price · {drop.perPerson} per person
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <ReminderToggle small on={reminder.on} busy={reminder.busy} onToggle={reminder.toggle} />
          <span className="ml-auto flex items-baseline gap-1.5">
            {drop.price !== null ? (
              <>
                <b className="font-display text-sm font-bold text-save">{money(drop.price)}</b>
                {drop.product.price !== null && <s className="text-xs text-ink-3">{money(drop.product.price)}</s>}
              </>
            ) : (
              drop.product.price !== null && <b className="font-display text-sm font-bold">{money(drop.product.price)}</b>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
