import "server-only";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { contentTypeOf, LocalStorage } from "@/shared/infrastructure/storage/local-storage";
import { services } from "./container";

// Uploads and files for STORAGE=local (development and single-server demos). With R2,
// browsers upload to the bucket and fetch from its domain, and these answer 404.

const json = (status: number, body: Record<string, string>) => Response.json(body, { status });

/** Saves a browser upload against its signed ticket. */
export async function receiveUpload(request: Request) {
  const { storage } = await services();
  if (!(storage instanceof LocalStorage)) return new Response(null, { status: 404 });
  const ticket = storage.verify(new URL(request.url).searchParams);
  if (!ticket) return json(403, { error: "invalid_ticket" });
  if (request.headers.get("content-type") !== ticket.type) return json(400, { error: "wrong_type" });
  const declared = Number(request.headers.get("content-length"));
  if (declared && declared !== ticket.bytes) return json(400, { error: "wrong_size" });
  if (!request.body) return json(400, { error: "empty" });
  try {
    await storage.receive(ticket, request.body);
  } catch (error) {
    return json(400, { error: "upload_failed", message: error instanceof Error ? error.message : String(error) });
  }
  return new Response(null, { status: 200 });
}

/** Serves a stored file, answering byte ranges (players use them to start fast and to seek). */
export async function serveMedia(key: string, rangeHeader: string | null) {
  const { storage } = await services();
  if (!(storage instanceof LocalStorage)) return new Response(null, { status: 404 });
  let file: string;
  let size: number;
  try {
    file = storage.path(key);
    const s = await stat(file);
    if (!s.isFile()) throw new Error("not a file");
    size = s.size;
  } catch {
    return new Response(null, { status: 404 });
  }

  const headers: Record<string, string> = {
    "content-type": contentTypeOf(key),
    "accept-ranges": "bytes",
    // Encoded files never change under the same key.
    "cache-control": key.startsWith("videos/") ? "public, max-age=31536000, immutable" : "private, max-age=3600",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader ?? "");
  if (!range || (!range[1] && !range[2])) {
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { ...headers, "content-length": String(size) } });
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
  return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, {
    status: 206,
    headers: { ...headers, "content-length": String(end - start + 1), "content-range": `bytes ${start}-${end}/${size}` },
  });
}
