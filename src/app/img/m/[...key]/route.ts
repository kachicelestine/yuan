import { MEDIA_CONTENT_TYPES, mediaImage, mediaRendition } from "@/server/media-images";

/** GET /img/m/catalog/<shop>/<id>.jpg?w=640&q=72 — an uploaded photo, resized and cached. */
export async function GET(request: Request, ctx: RouteContext<"/img/m/[...key]">) {
  const { key } = await ctx.params;
  const r = mediaRendition(key.join("/"), new URL(request.url).searchParams, request.headers.get("accept"));
  if (!r) return new Response("Not found", { status: 404 });
  try {
    const body = await mediaImage(r);
    return new Response(body as BodyInit, {
      headers: { "content-type": MEDIA_CONTENT_TYPES[r.format], "cache-control": "public, max-age=31536000, immutable", vary: "Accept" },
    });
  } catch {
    return new Response("Image unavailable", { status: 404, headers: { "cache-control": "no-store" } });
  }
}
