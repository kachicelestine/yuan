import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSellers } from "@/server/catalog";

const Ids = z
  .string()
  .transform((v) => [...new Set(v.split(",").filter(Boolean))])
  .pipe(z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(100));

/** GET /api/shops?ids=a,b: those shops' names and avatars (for lists of followed shops). */
export async function GET(request: NextRequest) {
  const ids = Ids.safeParse(request.nextUrl.searchParams.get("ids") ?? "");
  if (!ids.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const wanted = new Set(ids.data);
  const shops = (await getSellers()).filter((s) => wanted.has(s.id)).map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, verified: s.verified }));
  return Response.json({ shops }, { headers: { "cache-control": "private, max-age=300" } });
}
