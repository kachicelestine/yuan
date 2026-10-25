import { services } from "@/server/container";
import { allow, clientIp } from "@/server/rate-limits";
import { currentAccount } from "@/server/session";
import { readVoter } from "@/server/voter";

/** GET /api/polls/[id]: the poll's current votes, as the viewer sees them (refreshed while open). */
export async function GET(_request: Request, { params }: RouteContext<"/api/polls/[id]">) {
  if (!(await allow("feed", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await params;
  const account = await currentAccount();
  const poll = await (await services()).polls.view(id, { voter: account?.id ?? (await readVoter()), accountId: account?.id ?? null });
  return poll ? Response.json(poll, { headers: { "cache-control": "no-store" } }) : Response.json({ error: "not_found" }, { status: 404 });
}
