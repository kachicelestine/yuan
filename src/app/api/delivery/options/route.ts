import { z } from "zod";
import { shippingGrams } from "@/modules/delivery";
import { MAX_LINES, MAX_QTY, parcelWeights } from "@/modules/ordering";
import { getProductsBySlugs } from "@/server/catalog";
import { services } from "@/server/container";
import { getMarkets } from "@/server/markets";
import { allow, clientIp } from "@/server/rate-limits";

const Body = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  lines: z.array(z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/), qty: z.number().int().min(1).max(MAX_QTY) })).min(1).max(MAX_LINES),
  combine: z.boolean(),
});

/**
 * POST /api/delivery/options: every company that can carry this bag's parcels to the
 * country, priced for their weights, cheapest first. Checkout charges the same prices.
 */
export async function POST(request: Request) {
  if (!(await allow("search", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const { country, lines, combine } = parsed.data;
  const [market, products] = await Promise.all([getMarkets().then((all) => all.find((m) => m.code === country)), getProductsBySlugs(lines.map((l) => l.slug))]);
  if (!market) return Response.json({ error: "unknown_country" }, { status: 400 });
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const weighed = lines.flatMap((l) => {
    const p = bySlug.get(l.slug);
    return p ? [{ shipsFrom: p.shipsFrom, grams: shippingGrams(p), qty: l.qty, value: (p.price ?? 0) * l.qty, category: p.category }] : [];
  });
  const parcels = parcelWeights(weighed, combine);
  const options = await (await services()).delivery.options({
    country,
    region: market.region,
    extraDays: market.extraDays,
    parcels,
    valueCents: Math.round(weighed.reduce((n, l) => n + l.value, 0) * 100),
    category: weighed[0]?.category ?? "",
  });
  return Response.json(
    {
      parcels,
      // Prices in dollars, like everything else the shop screens show.
      options: options.map((o) => ({ ...o, price: o.price / 100 })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
