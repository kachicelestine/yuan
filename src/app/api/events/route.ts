import type { NextRequest } from "next/server";
import { z } from "zod";
import { allow, clientIp } from "@/server/rate-limits";
import { addWatch } from "@/server/watch-buffer";

// Watch beacons from the feed (navigator.sendBeacon on swipe and on leaving the page).
// A view counts once someone stays two seconds; watch time is capped per beacon so a
// tab left open can't inflate it.

const MAX_WATCH_MS = 10 * 60_000;

const Beacon = z.object({
  watches: z
    .array(
      z.object({
        v: z.string().min(1).max(64),
        /** Milliseconds watched since the last beacon. */
        ms: z.number().int().min(0).max(MAX_WATCH_MS),
        /** First time this video passed the two-second mark in this visit. */
        view: z.boolean().default(false),
        /** Played to the end at least once. */
        done: z.boolean().default(false),
      }),
    )
    .max(50),
});

/** POST /api/events — {"watches":[{"v":"v-solar","ms":8200,"view":true,"done":false}]} */
export async function POST(request: NextRequest) {
  if (!(await allow("events", await clientIp()))) return new Response(null, { status: 429 });
  let body: unknown;
  try {
    // sendBeacon posts text/plain to avoid a CORS preflight; the body is JSON either way.
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = Beacon.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  for (const w of parsed.data.watches) addWatch(w.v, { view: w.view, ms: w.ms, complete: w.done });
  return new Response(null, { status: 204 });
}
