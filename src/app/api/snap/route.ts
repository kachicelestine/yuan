import { z } from "zod";
import { askEnabled } from "@/server/ask";
import { allow, clientIp } from "@/server/rate-limits";
import { currentAccount } from "@/server/session";
import { MEDIA_TYPES, snap } from "@/server/snap";

// About 1.5 MB of photo once decoded; the browser shrinks it before sending.
const Body = z.object({ mediaType: z.enum(MEDIA_TYPES), data: z.string().max(2_000_000).regex(/^[A-Za-z0-9+/]+=*$/) });

/** POST /api/snap: a photo in, what it looks like and the listings that match out. */
export async function POST(request: Request) {
  if (!askEnabled()) return Response.json({ error: "disabled" }, { status: 503 });
  const account = await currentAccount();
  if (!(await allow("snap", account?.id ?? (await clientIp())))) return Response.json({ error: "rate_limited" }, { status: 429 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  try {
    return Response.json(await snap(parsed.data), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
