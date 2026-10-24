import { revalidateTag } from "next/cache";
import { z } from "zod";
import { isInternalRequest } from "@/server/internal";

const Body = z.object({ tags: z.array(z.string().min(1).max(256)).min(1).max(50) });

/**
 * POST /api/internal/revalidate {"tags": ["markets"]}. For background jobs and deploys,
 * authorised by INTERNAL_TOKEN. Marks tagged data stale; the next visit refreshes it.
 */
export async function POST(request: Request) {
  if (!isInternalRequest(request)) return Response.json({ error: "not_found" }, { status: 404 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid" }, { status: 400 });
  for (const tag of body.data.tags) revalidateTag(tag, "max");
  return Response.json({ revalidated: body.data.tags });
}
