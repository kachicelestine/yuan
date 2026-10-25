import type { NextRequest } from "next/server";
import { z } from "zod";
import { getProductsBySlugs } from "@/server/catalog";
import { allow, clientIp } from "@/server/rate-limits";

const Slugs = z
  .string()
  .transform((v) => [...new Set(v.split(",").filter(Boolean))])
  .pipe(z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(200));

/** GET /api/products?slugs=a,b,c: those listings as cards (for saved lists and boards). */
export async function GET(request: NextRequest) {
  if (!(await allow("search", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const slugs = Slugs.safeParse(request.nextUrl.searchParams.get("slugs") ?? "");
  if (!slugs.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const products = slugs.data.length ? await getProductsBySlugs(slugs.data) : [];
  return Response.json({ products }, { headers: { "cache-control": "private, max-age=60" } });
}
