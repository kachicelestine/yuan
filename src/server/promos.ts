import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PROMOS_TAG } from "./cache-tags";
import { services } from "./container";

/** Chops anyone can start now. A started chop changes the stock count, so it's kept fresh-ish. */
export async function getChopOffers() {
  "use cache";
  cacheLife("minutes");
  cacheTag(PROMOS_TAG);
  return (await services()).chops.offers(12);
}

/** Team buys anyone can start or join now, with the teams still filling. */
export async function getTeamOffers() {
  "use cache";
  cacheLife("minutes");
  cacheTag(PROMOS_TAG);
  return (await services()).promos.teamOffers(12);
}

/** The next 11.11 at 00:00 Beijing time (16:00 UTC on 10 November), or today's while it runs. */
export function festivalStart(now = new Date()) {
  const year = now.getUTCFullYear();
  // Month 10 is November (Date.UTC counts months from 0).
  const at = Date.UTC(year, 10, 10, 16);
  return new Date(at + 86_400_000 > now.getTime() ? at : Date.UTC(year + 1, 10, 10, 16));
}

export const festivalKey = (at: Date) => `festival:${at.toISOString().slice(0, 10)}`;
