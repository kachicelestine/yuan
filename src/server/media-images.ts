import "server-only";
import { join } from "node:path";
import sharp from "sharp";
import { DEVICE_SIZES, IMAGE_SIZES, QUALITIES } from "@/lib/image-config";
import { isStorageKey } from "@/shared/kernel";
import { services } from "./container";
import { PhotoCache } from "./photo-cache";

// Photos people upload (product shots, shop covers) are stored as they came off the phone,
// often 4000 px and several megabytes. /img/m/<key>?w=…&q=… serves them resized the way
// /img does for catalog photos: each size made once with sharp, then cached in memory and
// on disk. WebP rather than AVIF: AVIF encodes several times slower on a small server.

const WIDTHS = new Set([...DEVICE_SIZES, ...IMAGE_SIZES]);
const ALLOWED_QUALITIES = new Set(QUALITIES);
/** Only public media prefixes; identity documents live in other storage entirely. */
const PUBLIC_PREFIXES = ["catalog/", "shops/", "videos/", "avatars/", "notes/"];

export type MediaFormat = "webp" | "jpg";
export const MEDIA_CONTENT_TYPES: Record<MediaFormat, string> = { webp: "image/webp", jpg: "image/jpeg" };

/** A request the app would actually make, or null (404 instead of work). */
export function mediaRendition(key: string, query: URLSearchParams, accept: string | null) {
  const width = Number(query.get("w"));
  const quality = Number(query.get("q"));
  if (!isStorageKey(key) || !PUBLIC_PREFIXES.some((p) => key.startsWith(p)) || !WIDTHS.has(width) || !ALLOWED_QUALITIES.has(quality)) return null;
  const format: MediaFormat = accept?.includes("image/webp") ? "webp" : "jpg";
  return { key, width, quality, format };
}

async function render(r: NonNullable<ReturnType<typeof mediaRendition>>) {
  const original = await (await services()).storage.read(r.key);
  if (!original) throw new Error(`No such image: ${r.key}`);
  // rotate() applies the phone's EXIF orientation before the metadata is dropped.
  const image = sharp(original, { failOn: "none" }).rotate().resize({ width: r.width, withoutEnlargement: true });
  return r.format === "webp" ? image.webp({ quality: r.quality }).toBuffer() : image.jpeg({ quality: r.quality, mozjpeg: true }).toBuffer();
}

const globalForMedia = globalThis as typeof globalThis & { __lycheeMediaImages?: PhotoCache };

/** Resized bytes for a rendition, made once per size. */
export async function mediaImage(r: NonNullable<ReturnType<typeof mediaRendition>>) {
  globalForMedia.__lycheeMediaImages ??= new PhotoCache({
    dir: join(process.cwd(), ".next", "cache", "media-images"),
    maxMemoryBytes: 48 * 1024 * 1024,
    // The cache fetches by URL; here the "URL" names the rendition and the fetch renders it.
    fetcher: async (url) => {
      const [key, width, quality, format] = url.slice("media:".length).split("|");
      return new Response(await render({ key, width: Number(width), quality: Number(quality), format: format as MediaFormat }));
    },
    timeoutMs: 30_000,
  });
  return globalForMedia.__lycheeMediaImages.get(`media:${r.key}|${r.width}|${r.quality}|${r.format}`);
}
