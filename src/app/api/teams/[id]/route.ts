import { services } from "@/server/container";
import { allow, clientIp } from "@/server/rate-limits";
import { currentAccount } from "@/server/session";

/** GET /api/teams/[id]: who has joined so far (refreshed while the team is open). */
export async function GET(_request: Request, { params }: RouteContext<"/api/teams/[id]">) {
  if (!(await allow("feed", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await params;
  const account = await currentAccount();
  const team = await (await services()).promos.team(id, account?.id ?? null);
  return team ? Response.json(team, { headers: { "cache-control": "no-store" } }) : Response.json({ error: "not_found" }, { status: 404 });
}
