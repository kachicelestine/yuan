import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { LIVE_TAG } from "./cache-tags";
import { services } from "./container";

/** Shows on now, coming up and to replay. Starting or ending a show refreshes it at once. */
export async function getLiveLobby() {
  "use cache";
  cacheLife("minutes");
  cacheTag(LIVE_TAG);
  return (await services()).live.lobby();
}
