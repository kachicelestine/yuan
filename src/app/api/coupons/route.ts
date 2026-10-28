import type { NextRequest } from "next/server";
import { z } from "zod";
import { services } from "@/server/container";
import { allow, clientIp } from "@/server/rate-limits";

const list = z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(z.string().min(1).max(60)).max(100));
const Query = z.object({ ids: list.optional(), seller: z.string().min(1).max(60).optional(), open: z.enum(["1"]).optional() });

/**
 * GET /api/coupons?ids=a,b — these coupons (a wallet's details).
 * GET /api/coupons?open=1 — platform coupons anyone can claim now.
 * GET /api/coupons?seller=streetlab — a shop's vouchers running now.
 * Coupons are public offers, so answers can be cached briefly.
 */
export async function GET(request: NextRequest) {
  if (!(await allow("search", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const q = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!q.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const desk = (await services()).coupons;
  const [byIds, open, shop] = await Promise.all([
    q.data.ids ? desk.byIds(q.data.ids) : [],
    q.data.open ? desk.openPlatform() : [],
    q.data.seller ? desk.runningForSeller(q.data.seller) : [],
  ]);
  const seen = new Set<string>();
  const coupons = [...byIds, ...open, ...shop].filter((c) => !seen.has(c.id) && seen.add(c.id));
  return Response.json({ coupons }, { headers: { "cache-control": "public, max-age=30, s-maxage=60" } });
}
