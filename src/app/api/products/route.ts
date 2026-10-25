import type { NextRequest } from "next/server";
import { z } from "zod";
import { getProductsBySlugs, getSimilarProducts } from "@/server/catalog";
import { allow, clientIp } from "@/server/rate-limits";

const Slugs = z
  .string()
  .transform((v) => [...new Set(v.split(",").filter(Boolean))])
  .pipe(z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(200));

const Slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

/**
 * GET /api/products?slugs=a,b,c: those listings as cards (for saved lists, boards, the bag).
 * GET /api/products?similar=slug: listings like that one.
 */
export async function GET(request: NextRequest) {
  if (!(await allow("search", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const similar = request.nextUrl.searchParams.get("similar");
  if (similar !== null) {
    const slug = Slug.safeParse(similar);
    if (!slug.success) return Response.json({ error: "invalid_input" }, { status: 400 });
    return Response.json({ products: await getSimilarProducts(slug.data, 6) }, { headers: { "cache-control": "private, max-age=300" } });
  }
  const slugs = Slugs.safeParse(request.nextUrl.searchParams.get("slugs") ?? "");
  if (!slugs.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const products = slugs.data.length ? await getProductsBySlugs(slugs.data) : [];
  return Response.json({ products }, { headers: { "cache-control": "private, max-age=60" } });
}
