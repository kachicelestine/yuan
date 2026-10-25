// Time helpers for drops: instants shown in the shopper's own time zone.

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
