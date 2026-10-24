import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CROP_PARAMS, DEVICE_SIZES, IMAGE_SIZES, QUALITIES } from "@/lib/image-config";

export type Format = "avif" | "webp" | "jpg";
export const CONTENT_TYPES: Record<Format, string> = { avif: "image/avif", webp: "image/webp", jpg: "image/jpeg" };

const WIDTHS = new Set([...DEVICE_SIZES, ...IMAGE_SIZES]);
const ALLOWED_QUALITIES = new Set(QUALITIES);
const PHOTO = /^photo-[A-Za-z0-9-]{6,64}$/;
const CROP_VALUE = /^[A-Za-z0-9.:-]{1,24}$/;

/** The best format the browser says it takes. Unsplash encodes it; we never transcode. */
export const negotiate = (accept: string | null): Format => (accept?.includes("image/avif") ? "avif" : accept?.includes("image/webp") ? "webp" : "jpg");

/**
 * The exact Unsplash rendition behind /img/<photo>?…, or null when the request isn't one the
 * app would make (unknown size or quality, odd crop values): those get a 404, not a fetch.
 */
export function upstreamUrl(photo: string, query: URLSearchParams, format: Format): string | null {
  if (!PHOTO.test(photo)) return null;
  const width = Number(query.get("w"));
  const quality = Number(query.get("q"));
  if (!WIDTHS.has(width) || !ALLOWED_QUALITIES.has(quality)) return null;
  const params = new URLSearchParams();
  for (const key of CROP_PARAMS) {
    const value = query.get(key);
    if (value === null) continue;
    if (!CROP_VALUE.test(value)) return null;
    params.set(key, value);
  }
  params.set("w", String(width));
  params.set("q", String(quality));
  params.set("fm", format);
  return `https://images.unsplash.com/${photo}?${params}`;
}

type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

/**
 * Photo renditions kept in memory (most recent first, up to a byte budget) and on disk, so
 * each one is fetched from Unsplash once. Concurrent requests for the same one share a fetch.
 * A read-only disk (serverless) just skips the disk tier; failures are never cached.
 */
export class PhotoCache {
  private readonly memory = new Map<string, Uint8Array>();
  private readonly inflight = new Map<string, Promise<Uint8Array>>();
  private bytes = 0;

  constructor(private readonly options: { dir: string | null; maxMemoryBytes: number; fetcher: Fetcher; timeoutMs: number }) {}

  async get(url: string): Promise<Uint8Array> {
    const key = createHash("sha256").update(url).digest("hex").slice(0, 40);
    const hit = this.memory.get(key);
    if (hit) {
      this.memory.delete(key);
      this.memory.set(key, hit);
      return hit;
    }
    let pending = this.inflight.get(key);
    if (!pending) {
      pending = this.load(key, url).finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }
    const body = await pending;
    this.remember(key, body);
    return body;
  }

  private async load(key: string, url: string) {
    const { dir, fetcher, timeoutMs } = this.options;
    const file = dir ? join(dir, key) : null;
    const onDisk = file ? await readFile(file).catch(() => null) : null;
    if (onDisk) return new Uint8Array(onDisk);
    const res = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`Unsplash answered ${res.status} for ${url}`);
    const body = new Uint8Array(await res.arrayBuffer());
    if (dir && file) {
      await mkdir(dir, { recursive: true })
        .then(() => writeFile(file, body))
        .catch(() => {});
    }
    return body;
  }

  private remember(key: string, body: Uint8Array) {
    if (this.memory.has(key) || body.byteLength > this.options.maxMemoryBytes) return;
    this.memory.set(key, body);
    this.bytes += body.byteLength;
    for (const [oldest, value] of this.memory) {
      if (this.bytes <= this.options.maxMemoryBytes) break;
      this.memory.delete(oldest);
      this.bytes -= value.byteLength;
    }
  }
}

// One cache per process, kept on globalThis so dev hot reloads reuse it.
const globalForPhotos = globalThis as typeof globalThis & { __lycheePhotos?: PhotoCache };

export function photoCache() {
  globalForPhotos.__lycheePhotos ??= new PhotoCache({
    dir: join(process.cwd(), ".next", "cache", "photos"),
    maxMemoryBytes: 64 * 1024 * 1024,
    fetcher: (url, init) => fetch(url, init),
    timeoutMs: 20_000,
  });
  return globalForPhotos.__lycheePhotos;
}
