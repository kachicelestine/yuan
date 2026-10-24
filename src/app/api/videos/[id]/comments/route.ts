import type { NextRequest } from "next/server";
import { z } from "zod";
import { getComments } from "@/server/content";
import { allow, clientIp } from "@/server/rate-limits";

const Query = z.object({ before: z.iso.datetime().optional() });

/** GET /api/videos/v-solar/comments?before=2026-10-24T09:00:00.000Z — the thread, newest first. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/videos/[id]/comments">) {
  if (!(await allow("feed", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await params;
  const q = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!q.success || id.length > 64) return Response.json({ error: "invalid_input" }, { status: 400 });
  return Response.json({ comments: await getComments(id, q.data.before) });
}
