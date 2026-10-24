import type { NextRequest } from "next/server";
import { z } from "zod";
import { allow, clientIp } from "@/server/rate-limits";
import { searchAll } from "@/server/search";

const Query = z.object({ q: z.string().trim().max(200).default("") });

/** GET /api/search/all?q=solar: the videos, shops and live rooms a search finds. */
export async function GET(request: NextRequest) {
  if (!(await allow("search", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_input", message: z.prettifyError(parsed.error) }, { status: 400 });
  return Response.json(await searchAll(parsed.data.q));
}
