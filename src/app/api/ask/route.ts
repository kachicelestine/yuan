import { z } from "zod";
import type { AskEvent } from "@/lib/ask";
import { ask, askEnabled } from "@/server/ask";
import { getMarkets } from "@/server/markets";
import { allow } from "@/server/rate-limits";
import { currentAccount } from "@/server/session";

const Body = z.object({
  turns: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(2000) })).min(1).max(12),
  country: z.string().regex(/^[A-Z]{2}$/),
});

/**
 * POST /api/ask: one question to the assistant, answered as newline-delimited JSON
 * (progress steps, then the blocks to show). Signed-in shoppers only: answers cost tokens.
 */
export async function POST(request: Request) {
  if (!askEnabled()) return Response.json({ error: "disabled" }, { status: 503 });
  const account = await currentAccount();
  if (!account) return Response.json({ error: "sign_in_required" }, { status: 401 });
  if (!(await allow("ask", account.id))) return Response.json({ error: "rate_limited" }, { status: 429 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.turns.at(-1)?.role !== "user") return Response.json({ error: "invalid_input" }, { status: 400 });
  const market = (await getMarkets()).find((m) => m.code === parsed.data.country);
  if (!market) return Response.json({ error: "unknown_country" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AskEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      for await (const event of ask(parsed.data.turns, market)) send(event);
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
