import { services } from "@/server/container";
import { allow, clientIp } from "@/server/rate-limits";
import { currentAccount } from "@/server/session";
import { readVoter } from "@/server/voter";

/** GET /api/chops/[id]: a chop's cuts so far, as the viewer sees them (refreshed while open). */
export async function GET(_request: Request, { params }: RouteContext<"/api/chops/[id]">) {
  if (!(await allow("feed", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await params;
  const account = await currentAccount();
  const chop = await (await services()).chops.view(id, { cutter: account?.id ?? (await readVoter()), accountId: account?.id ?? null });
  return chop ? Response.json(chop, { headers: { "cache-control": "no-store" } }) : Response.json({ error: "not_found" }, { status: 404 });
}
