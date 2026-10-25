import type { NextRequest } from "next/server";
import { isBoard, isPeriod } from "@/lib/rankings";
import { getRankings } from "@/server/rankings";
import { allow, clientIp } from "@/server/rate-limits";

/** GET /api/rankings?board=hot&period=week&category=energy */
export async function GET(request: NextRequest) {
  if (!(await allow("search", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429 });
  const q = request.nextUrl.searchParams;
  const board = q.get("board") ?? "hot";
  const period = q.get("period") ?? "week";
  const category = q.get("category") ?? undefined;
  if (!isBoard(board) || !isPeriod(period) || (category !== undefined && !/^[a-z0-9-]{1,40}$/.test(category))) return Response.json({ error: "invalid_input" }, { status: 400 });
  return Response.json(await getRankings(board, period, category));
}
