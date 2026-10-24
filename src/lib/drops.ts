// Scheduling for drops: Beijing-time fixtures turned into real instants and local labels.
import { drops, festival } from "@/fixtures/drops";
import type { Drop } from "@/lib/types";

export { festival };

const DAY = 86_400_000;
const BEIJING = 8 * 3_600_000;

/** Midnight today in Beijing, as a timestamp. */
function beijingMidnight(now: number) {
  const local = now + BEIJING;
  return local - (local % DAY) - BEIJING;
}

export function dropAt(drop: Drop, now: number) {
  const [h, m] = drop.time.split(":").map(Number);
  return beijingMidnight(now) + drop.inDays * DAY + (h * 60 + m) * 60_000;
}

/** The next 11.11 at 00:00 Beijing time, or today's if it's running. */
export function festivalAt(now: number) {
  const year = new Date(now + BEIJING).getUTCFullYear();
  const at = Date.UTC(year, festival.month, festival.day) - BEIJING;
  return at + DAY > now ? at : Date.UTC(year + 1, festival.month, festival.day) - BEIJING;
}

export function upcomingDrops(now: number) {
  return drops.map((drop) => ({ drop, at: dropAt(drop, now) })).sort((a, b) => a.at - b.at);
}

/** Day key, weekday, date and time of an instant in a time zone. */
export function localParts(at: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { key: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, day: Number(parts.day), month: parts.month, time: `${parts.hour}:${parts.minute}` };
}

/** "in 2d 4h", "in 3h 20m", "in 12m" or "Live now". */
export function countdown(ms: number) {
  if (ms <= 0) return "Live now";
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m % 60}m`;
  return `in ${m}m`;
}
