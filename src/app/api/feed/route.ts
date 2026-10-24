import type { NextRequest } from "next/server";
import { z } from "zod";
import { getFeedItems, getFeedPage, getFollowingPage, PAGE } from "@/server/feed";
import { allow, clientIp } from "@/server/rate-limits";

const ids = z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(z.string().min(1).max(64)).max(200));

const Query = z.object({
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(20).default(PAGE),
  /** The Following feed: shops this device follows. */
  following: ids.optional(),
  /** Specific videos (a shared link). */
  ids: ids.optional(),
});

/**
 * GET /api/feed?offset=8 — the next page of For You.
 * GET /api/feed?following=s1,s2 — newest from followed shops.
 * GET /api/feed?ids=v-solar — specific videos.
 */
export async function GET(request: NextRequest) {
  if (!(await allow("feed", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_input", message: z.prettifyError(parsed.error) }, { status: 400 });
  const q = parsed.data;
  if (q.ids) return Response.json({ items: await getFeedItems(q.ids.slice(0, 20)), next: null });
  const page = q.following ? await getFollowingPage(q.following, q.offset, q.limit) : await getFeedPage(q.offset, q.limit);
  // The For You order is the same for everyone, so a CDN can hold it briefly.
  const cache = q.following ? "private, max-age=30" : "public, max-age=30, s-maxage=60, stale-while-revalidate=300";
  return Response.json(page, { headers: { "cache-control": cache } });
}
