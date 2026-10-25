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
