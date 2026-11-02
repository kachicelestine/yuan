import type { NextRequest } from "next/server";
import { z } from "zod";
import { PRODUCT_SORTS, SELLER_KINDS } from "@/modules/catalog";
import { adViewer, sponsored } from "@/server/ads";
import { searchCatalog } from "@/server/catalog";
import { allow, clientIp } from "@/server/rate-limits";
import { money } from "@/shared/kernel";

/** Comma-separated lists, e.g. cat=energy,beauty */
const list = <T extends z.ZodType>(item: T) => z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(item).max(20));
const flag = z.stringbool().optional();

const Query = z.object({
  q: z.string().trim().max(200).default(""),
  /** US dollars, as shown to the shopper after converting their currency. */
  minPrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  maxPrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  cat: list(z.string().regex(/^[a-z0-9-]{1,40}$/)).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  kind: list(z.enum(SELLER_KINDS)).optional(),
  sale: flag,
  bulk: flag,
  fast: flag,
  verified: flag,
  sort: z.enum(PRODUCT_SORTS).default("best"),
  limit: z.coerce.number().int().min(1).max(100).default(60),
});

/** GET /api/search?q=solar%20panels&maxPrice=100&sort=price-asc */
export async function GET(request: NextRequest) {
  if (!(await allow("search", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "invalid_input", message: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const p = parsed.data;
  const filters = {
    text: p.q,
    minPrice: p.minPrice === undefined ? undefined : money.fromDollars(p.minPrice),
    maxPrice: p.maxPrice === undefined ? undefined : money.fromDollars(p.maxPrice),
    categories: p.cat,
    minRating: p.rating,
    sellerKinds: p.kind,
    onSale: p.sale,
    bulk: p.bulk,
    fast: p.fast,
    verified: p.verified,
  };
  // Sponsored slots only beside a best-match search for something (they must match it too).
  const withAds = p.sort === "best" && (p.q !== "" || (p.cat?.length ?? 0) > 0);
  const [products, ads] = await Promise.all([searchCatalog({ ...filters, sort: p.sort, limit: p.limit }), withAds ? sponsored(filters, 2, await adViewer()) : Promise.resolve([])]);
  return Response.json({ products, sponsored: ads });
}
