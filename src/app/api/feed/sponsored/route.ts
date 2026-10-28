import type { NextRequest } from "next/server";
import { sponsoredVideo } from "@/server/ads";
import { allow, clientIp } from "@/server/rate-limits";

/**
 * GET /api/feed/sponsored?skip=v1,v2 — a boosted video for the next sponsored slide, or
 * null. Decided per request by the ads auction (and counted as an impression), so never cached.
 */
export async function GET(request: NextRequest) {
  if (!(await allow("feed", await clientIp()))) return Response.json({ item: null }, { status: 429, headers: { "retry-after": "60" } });
  const skip = (request.nextUrl.searchParams.get("skip") ?? "").split(",").filter(Boolean).slice(0, 50);
  return Response.json({ item: await sponsoredVideo(skip) }, { headers: { "cache-control": "private, no-store" } });
}
