import type { NextRequest } from "next/server";
import { messageParty } from "@/server/inbox";
import { services } from "@/server/container";
import { allow, clientIp } from "@/server/rate-limits";

/** GET /api/messages/[id]?after=ISO: new messages in a conversation, for whichever side is asking; marks them read. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/messages/[id]">) {
  if (!(await allow("feed", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await params;
  const party = await messageParty(id);
  if (!party) return Response.json({ error: "not_found" }, { status: 404 });
  const after = request.nextUrl.searchParams.get("after");
  const app = await services();
  const thread = await app.messaging.thread(id, party, after && !Number.isNaN(Date.parse(after)) ? new Date(after) : undefined);
  if (!thread) return Response.json({ error: "not_found" }, { status: 404 });
  await app.messaging.markRead(id, party);
  return Response.json(thread, { headers: { "cache-control": "no-store" } });
}
