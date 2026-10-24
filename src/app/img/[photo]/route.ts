import { CONTENT_TYPES, negotiate, photoCache, upstreamUrl } from "@/server/photo-cache";

/**
 * GET /img/photo-…?ar=…&w=390&q=72 — a photo rendition served from our own origin (see
 * src/lib/image-loader.ts). Fetched from Unsplash once, then cached; the response never
 * changes for a URL, so browsers and CDNs may keep it for a year.
 */
export async function GET(request: Request, ctx: RouteContext<"/img/[photo]">) {
  const { photo } = await ctx.params;
  const format = negotiate(request.headers.get("accept"));
  const url = upstreamUrl(photo, new URL(request.url).searchParams, format);
  if (!url) return new Response("Not found", { status: 404 });
  try {
    const body = await photoCache().get(url);
    return new Response(body as BodyInit, {
      headers: {
        "content-type": CONTENT_TYPES[format],
        "cache-control": "public, max-age=31536000, immutable",
        // AVIF, WebP or JPEG depends on the browser's Accept header; caches must key on it.
        vary: "Accept",
      },
    });
  } catch {
    return new Response("Photo unavailable", { status: 502, headers: { "cache-control": "no-store" } });
  }
}
