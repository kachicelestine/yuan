import { z } from "zod";
import type { AskEvent } from "@/lib/ask";
import { ask, askEnabled } from "@/server/ask";
import { services } from "@/server/container";
import { getMarkets } from "@/server/markets";
import { allow } from "@/server/rate-limits";
import { currentAccount } from "@/server/session";

// A photo is about 1.5 MB at most once decoded; the browser shrinks it before sending.
const Photo = z.string().max(2_000_000).regex(/^[A-Za-z0-9+/]+=*$/);

const Body = z.object({
  turns: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(2000), photo: Photo.optional() })).min(1).max(12),
  country: z.string().regex(/^[A-Z]{2}$/),
});

/**
 * POST /api/ask: one question to the assistant, answered as newline-delimited JSON
 * (progress steps, then the blocks to show). Signed-in shoppers only: answers cost tokens.
 * The conversation is kept for the account, so it carries on from any device.
 */
export async function POST(request: Request) {
  if (!askEnabled()) return Response.json({ error: "disabled" }, { status: 503 });
  const account = await currentAccount();
  if (!account) return Response.json({ error: "sign_in_required" }, { status: 401 });
  if (!(await allow("ask", account.id))) return Response.json({ error: "rate_limited" }, { status: 429 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  // Only the question being asked now may carry a photo.
  if (!parsed.success || parsed.data.turns.at(-1)?.role !== "user" || parsed.data.turns.slice(0, -1).some((t) => t.photo)) return Response.json({ error: "invalid_input" }, { status: 400 });
  const market = (await getMarkets()).find((m) => m.code === parsed.data.country);
  if (!market) return Response.json({ error: "unknown_country" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AskEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let answer = "";
      for await (const event of ask(parsed.data.turns, market)) {
        if (event.type === "blocks") answer = event.blocks.flatMap((b) => (b.kind === "text" ? [b.text] : [])).join("\n");
        send(event);
      }
      if (answer) await (await services()).askHistory.save(account.id, [...parsed.data.turns, { role: "assistant", text: answer }]).catch(() => {});
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

/** DELETE /api/ask: "New chat" forgets the kept conversation. */
export async function DELETE() {
  const account = await currentAccount();
  if (!account) return Response.json({ error: "sign_in_required" }, { status: 401 });
  await (await services()).askHistory.forget(account.id);
  return new Response(null, { status: 204 });
}
