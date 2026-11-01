"use client";

import Image from "next/image";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { countdown, localParts, viewerTimeZone } from "@/lib/drops";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";

const kindLabel = { show: "Live show", tour: "Factory tour", auction: "Auction" } as const;

export type ScheduledShow = { id: string; title: string; image: string; kind: "show" | "tour" | "auction"; hostName: string; sellerName: string; /** ISO start time. */ at: string };

/** Upcoming lives in the shopper's time zone, each with a reminder. */
export function LiveSchedule({ shows }: { shows: ScheduledShow[] }) {
  const now = useNow(60_000);
  const { market } = useStore();
  const [reminders, setReminders] = useStored<string[]>("app.reminders", []);
  const timeZone = viewerTimeZone(market.timeZone);
  const today = now === null ? "" : localParts(now, timeZone).key;

  return (
    <ul className="glass flex flex-col divide-y divide-line rounded-[26px] px-3">
      {shows.map((s) => {
        const at = now === null ? null : new Date(s.at).getTime();
        const local = at === null ? null : localParts(at, timeZone);
        const on = reminders.includes(s.id);
        return (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <Image src={s.image} alt="" width={60} height={60} sizes="60px" className="size-[60px] shrink-0 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold tracking-[0.06em] text-accent-light">
                {local ? `${local.key === today ? "TODAY" : local.weekday.toUpperCase()} ${local.time}` : "··:··"} · {at !== null && now !== null ? countdown(at - now).toUpperCase() : ""}
              </p>
              <p className="line-clamp-2 text-sm leading-snug font-semibold">{s.title}</p>
              <p className="text-xs text-ink-2">
                {kindLabel[s.kind]} · {s.hostName}, {s.sellerName}
              </p>
            </div>
            <button
              type="button"
              aria-pressed={on}
              aria-label={on ? `Reminder set for ${s.title}` : `Remind me about ${s.title}`}
              onClick={() => setReminders(on ? reminders.filter((r) => r !== s.id) : [...reminders, s.id])}
              className={`grid size-11 shrink-0 place-items-center rounded-full transition-colors ${on ? "bg-positive/15 text-positive" : "glass-inset"}`}
            >
              <Icon name={on ? "check" : "bell"} className="size-5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
