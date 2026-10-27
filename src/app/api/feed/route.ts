import type { NextRequest } from "next/server";
import { z } from "zod";
import { services } from "@/server/container";
import { getFeedItems, getFeedPage, getFollowingPage, PAGE } from "@/server/feed";
import { allow, clientIp } from "@/server/rate-limits";
import { currentAccount } from "@/server/session";

const ids = z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(z.string().min(1).max(64)).max(200));

const Query = z.object({
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(20).default(PAGE),
  /** The Following feed: shops this device follows. */
  following: ids.optional(),
  /** Add the people the signed-in account follows to the Following feed. */
  people: z.enum(["0", "1"]).optional(),
  /** Specific videos (a shared link). */
  ids: ids.optional(),
});

/**
 * GET /api/feed?offset=8 — the next page of For You.
 * GET /api/feed?following=s1,s2&people=1 — newest from followed shops (and, signed in, people).
 * GET /api/feed?ids=v-solar — specific videos.
 */
export async function GET(request: NextRequest) {
  if (!(await allow("feed", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_input", message: z.prettifyError(parsed.error) }, { status: 400 });
  const q = parsed.data;
  if (q.ids) return Response.json({ items: await getFeedItems(q.ids.slice(0, 20)), next: null });
  const followingFeed = q.following !== undefined || q.people === "1";
  let page;
  if (followingFeed) {
    const account = q.people === "1" ? await currentAccount() : null;
    const people = account ? await (await services()).profiles.followingIds(account.id) : [];
    page = await getFollowingPage(q.following ?? [], people, q.offset, q.limit);
  } else page = await getFeedPage(q.offset, q.limit);
  // The For You order is the same for everyone, so a CDN can hold it briefly.
  const cache = followingFeed ? "private, max-age=30" : "public, max-age=30, s-maxage=60, stale-while-revalidate=300";
  return Response.json(page, { headers: { "cache-control": cache } });
}
