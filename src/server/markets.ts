import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { MarketView } from "@/modules/markets";
import { MARKETS_TAG } from "./cache-tags";
import { services } from "./container";

export { MARKETS_TAG };

/** Every country we deliver to, priced for display. Changes rarely, so it's cached for a day. */
export async function getMarkets(): Promise<MarketView[]> {
  "use cache";
  cacheLife("days");
  cacheTag(MARKETS_TAG);
  return (await services()).listMarkets();
}
