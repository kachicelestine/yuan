import { z } from "zod";
import { ownInvoice } from "@/server/invoices";
import { currentAccount } from "@/server/session";

/**
 * GET /api/invoices/:id — the invoice's current state, synced with the chain first.
 * Only the buyer who placed the order can read it. The pay page polls this; checking
 * is idempotent, so polling is safe.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "not_found" }, { status: 404 });
  const account = await currentAccount();
  const owned = account && (await ownInvoice(id, account.id));
  if (!owned) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(owned.invoice, { headers: { "cache-control": "no-store" } });
}
