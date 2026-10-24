import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import imageLoader from "@/lib/image-loader";
import { photo } from "@/lib/images";
import { negotiate, PhotoCache, upstreamUrl } from "./photo-cache";

const route = (src: string, width: number, quality?: number) => {
  const url = new URL(imageLoader({ src, width, quality }), "http://app.test");
  return { photo: url.pathname.replace("/img/", ""), query: url.searchParams };
};

describe("the /img route's contract with the loader", () => {
  it("sends each srcset entry to our own origin with just the crop, width and quality", () => {
    const src = photo("1559227657-1835d2db47b6", { ar: "16:9", fy: 0.4 });
    expect(imageLoader({ src, width: 390 })).toBe("/img/photo-1559227657-1835d2db47b6?ar=16%3A9&fit=crop&crop=focalpoint&fp-x=0.5&fp-y=0.4&w=390&q=72");
    expect(imageLoader({ src: "https://flagcdn.com/gh.svg", width: 48 })).toBe("https://flagcdn.com/gh.svg");
  });

  it("asks Unsplash for exactly that rendition, in the browser's best format", () => {
    const { photo: id, query } = route(photo("1559227657-1835d2db47b6", { ar: "1:1" }), 1080);
    expect(upstreamUrl(id, query, negotiate("image/avif,image/webp,*/*"))).toBe(
      "https://images.unsplash.com/photo-1559227657-1835d2db47b6?ar=1%3A1&fit=crop&crop=focalpoint&fp-x=0.5&fp-y=0.5&w=1080&q=50&fm=avif",
    );
    expect(negotiate("image/webp,*/*")).toBe("webp");
    expect(negotiate(null)).toBe("jpg");
  });

  it("refuses anything the app wouldn't ask for", () => {
    const ok = route(photo("1559227657-1835d2db47b6"), 390);
    expect(upstreamUrl(ok.photo, ok.query, "avif")).not.toBeNull();
    const tweak = (key: string, value: string) => {
      const query = new URLSearchParams(ok.query);
      query.set(key, value);
      return upstreamUrl(ok.photo, query, "avif");
    };
    expect(tweak("w", "391")).toBeNull();
    expect(tweak("q", "99")).toBeNull();
    expect(tweak("ar", "1:1&blur=200")).toBeNull();
    expect(upstreamUrl("../../etc/passwd", ok.query, "avif")).toBeNull();
    expect(upstreamUrl("photo-x", ok.query, "avif")).toBeNull();
  });
});

describe("PhotoCache", () => {
  const dirs: string[] = [];
  afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));
  const newDir = async () => {
    const dir = await mkdtemp(join(tmpdir(), "lychee-photos-"));
    dirs.push(dir);
    return dir;
  };
  const bytes = (n: number) => new Response(new Uint8Array(n).fill(7));

  it("fetches each rendition once, even when many requests arrive together", async () => {
    const fetcher = vi.fn(async () => bytes(10));
    const cache = new PhotoCache({ dir: await newDir(), maxMemoryBytes: 1000, fetcher, timeoutMs: 1000 });
    const all = await Promise.all([cache.get("u1"), cache.get("u1"), cache.get("u1")]);
    expect(all.map((b) => b.byteLength)).toEqual([10, 10, 10]);
    await cache.get("u1");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps renditions on disk across restarts", async () => {
    const dir = await newDir();
    const first = vi.fn(async () => bytes(5));
    await new PhotoCache({ dir, maxMemoryBytes: 1000, fetcher: first, timeoutMs: 1000 }).get("u2");
    const second = vi.fn(async () => bytes(99));
    expect((await new PhotoCache({ dir, maxMemoryBytes: 1000, fetcher: second, timeoutMs: 1000 }).get("u2")).byteLength).toBe(5);
    expect(second).not.toHaveBeenCalled();
  });

  it("never caches a failure", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("nope", { status: 503 })).mockResolvedValueOnce(bytes(3));
    const cache = new PhotoCache({ dir: null, maxMemoryBytes: 1000, fetcher, timeoutMs: 1000 });
    await expect(cache.get("u3")).rejects.toThrow("503");
    expect((await cache.get("u3")).byteLength).toBe(3);
  });

  it("stays within its memory budget, dropping the least recently used", async () => {
    const fetcher = vi.fn(async () => bytes(40));
    const cache = new PhotoCache({ dir: null, maxMemoryBytes: 100, fetcher, timeoutMs: 1000 });
    await cache.get("a");
    await cache.get("b");
    await cache.get("a"); // a is now the most recent
    await cache.get("c"); // over budget: b goes
    expect(fetcher).toHaveBeenCalledTimes(3);
    await cache.get("a");
    expect(fetcher).toHaveBeenCalledTimes(3);
    await cache.get("b");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
