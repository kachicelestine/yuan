import { liveStream } from "@/server/live-stream";

export const maxDuration = 60;

/** GET /api/live/<show>/stream — Server-Sent Events for a live room. */
export async function GET(request: Request, ctx: RouteContext<"/api/live/[id]/stream">) {
  const { id } = await ctx.params;
  if (id.length > 64) return new Response(null, { status: 404 });
  return liveStream(id, request.signal);
}
