"use client";

import { CROP_PARAMS, defaultQuality } from "./image-config";

type LoaderArgs = { src: string; width: number; quality?: number };

const UNSPLASH = "https://images.unsplash.com/";
const MEDIA = "/media/";

/**
 * Photos are stored as full Unsplash URLs. Each srcset entry points at our own /img route,
 * which fetches that exact size from Unsplash's CDN once, caches it, and serves it from our
 * origin: no second connection for the phone to open, and a CDN in front of us can cache it.
 * Other URLs pass through untouched.
 */
export default function imageLoader({ src, width, quality }: LoaderArgs) {
  // Photos people uploaded (stored under /media/…) are resized by /img/m.
  if (src.startsWith(MEDIA) && !src.endsWith(".svg")) return `/img/m/${src.slice(MEDIA.length)}?w=${width}&q=${quality ?? defaultQuality(width)}`;
  if (!src.startsWith(UNSPLASH)) return src;
  const stored = new URL(src);
  const params = new URLSearchParams();
  for (const key of CROP_PARAMS) {
    const value = stored.searchParams.get(key);
    if (value !== null) params.set(key, value);
  }
  if (!params.has("fit")) params.set("fit", "max");
  params.set("w", String(width));
  params.set("q", String(quality ?? defaultQuality(width)));
  return `/img${stored.pathname}?${params}`;
}
