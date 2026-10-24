import { services } from "@/server/container";

/** GET /api/live/lots/<id> — a lot's state; a lot whose clock ran out is closed on the way. */
export async function GET(_request: Request, ctx: RouteContext<"/api/live/lots/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const lot = await (await services()).live.lot(id);
  return lot ? Response.json({ lot }, { headers: { "cache-control": "no-store" } }) : new Response(null, { status: 404 });
}
