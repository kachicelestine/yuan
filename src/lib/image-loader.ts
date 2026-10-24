"use client";

type LoaderArgs = { src: string; width: number; quality?: number };

// `src` is either a local path ("/logo.svg") or an Unsplash photo key built by
// `photo()` in ./images, e.g. "photo-123?ar=9:19.5&fit=crop". The CDN does the
// resizing, so we only add the width, quality and format negotiation.
export default function imageLoader({ src, width, quality }: LoaderArgs) {
  if (src.startsWith("/")) return src;
  const url = new URL(src.startsWith("http") ? src : `https://images.unsplash.com/${src}`);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 72));
  url.searchParams.set("auto", "format");
  if (!url.searchParams.has("fit")) url.searchParams.set("fit", "max");
  return url.toString();
}

