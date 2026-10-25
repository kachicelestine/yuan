import type { NextRequest } from "next/server";
import { z } from "zod";
import { sponsored } from "@/server/ads";
import { allow, clientIp } from "@/server/rate-limits";

const Query = z.object({ category: z.string().regex(/^[a-z0-9-]{1,40}$/), slots: z.coerce.number().int().min(1).max(4).default(2) });

/** GET /api/ads?category=energy: sponsored listings for a category page. */
export async function GET(request: NextRequest) {
  if (!(await allow("search", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  return Response.json({ sponsored: await sponsored({ text: "", categories: [parsed.data.category] }, parsed.data.slots) }, { headers: { "cache-control": "no-store" } });
}
