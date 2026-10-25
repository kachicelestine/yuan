import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, productTag } from "./cache-tags";
import { services } from "./container";

/** The blind-box series sold as this listing, for the product page's link to the box machine. */
export async function getBoxSeriesFor(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG, productTag(slug));
  const s = await (await services()).blindBoxes.seriesFor(slug);
  return s ? { id: s.id, title: s.title } : null;
}
