import type { NextRequest } from "next/server";
import { z } from "zod";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

const Query = z.object({
  target: z.enum(["video", "note", "comment", "question", "review"]),
  ids: z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(z.string().min(1).max(64)).min(1).max(200)),
});

/** GET /api/me/likes?target=video&ids=a,b — which of these the signed-in person has liked. */
export async function GET(request: NextRequest) {
  const account = await currentAccount();
  if (!account) return Response.json({ ids: [] }, { headers: { "cache-control": "private, no-store" } });
  const q = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!q.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const ids = await (await services()).interactions.likedBy(account.id, q.data.target, q.data.ids);
  return Response.json({ ids }, { headers: { "cache-control": "private, no-store" } });
}
