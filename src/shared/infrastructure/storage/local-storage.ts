import { createHmac, timingSafeEqual } from "node:crypto";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { isStorageKey, type ObjectStorage, type SignedUpload } from "@/shared/kernel";

const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Content type from a key's extension. */
export const contentTypeOf = (key: string) => TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

export type UploadTicket = { key: string; bytes: number; type: string; exp: number };

/**
 * Files on this machine's disk, for development and single-server demos. Uploads go to
 * `PUT /api/media/upload` with a signed ticket; files are served by `GET /media/<key>`.
 */
export class LocalStorage implements ObjectStorage {
  private readonly root: string;

  constructor(private readonly options: { dir: string; baseUrl: string; secret: string; now?: () => Date }) {
    this.root = resolve(options.dir);
  }

  /** The file behind a key; throws on keys that could escape the folder. */
  path(key: string) {
    if (!isStorageKey(key)) throw new Error(`Bad storage key: ${key}`);
    const file = resolve(this.root, key);
    if (!file.startsWith(this.root + sep)) throw new Error(`Bad storage key: ${key}`);
    return file;
  }

  private sign(t: UploadTicket) {
    return createHmac("sha256", this.options.secret).update(`${t.key}\n${t.bytes}\n${t.type}\n${t.exp}`).digest("base64url");
  }

  async signUpload(key: string, file: { contentType: string; bytes: number }, expiresInSeconds: number): Promise<SignedUpload> {
    this.path(key);
    const now = this.options.now?.() ?? new Date();
    const ticket: UploadTicket = { key, bytes: file.bytes, type: file.contentType, exp: Math.floor(now.getTime() / 1000) + expiresInSeconds };
    const query = new URLSearchParams({ key, bytes: String(ticket.bytes), type: ticket.type, exp: String(ticket.exp), sig: this.sign(ticket) });
    return { url: `/api/media/upload?${query}`, method: "PUT", headers: { "content-type": file.contentType } };
  }

  /** The ticket in an upload URL, if its signature holds and it hasn't expired. */
  verify(params: URLSearchParams): UploadTicket | null {
    const ticket: UploadTicket = { key: params.get("key") ?? "", bytes: Number(params.get("bytes")), type: params.get("type") ?? "", exp: Number(params.get("exp")) };
    const sig = Buffer.from(params.get("sig") ?? "");
    const expected = Buffer.from(this.sign(ticket));
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
    const now = Math.floor((this.options.now?.() ?? new Date()).getTime() / 1000);
    if (!isStorageKey(ticket.key) || !Number.isSafeInteger(ticket.bytes) || ticket.exp < now) return null;
    return ticket;
  }

  /** Writes an upload's body, refusing anything longer or shorter than the ticket says. */
  async receive(ticket: UploadTicket, body: ReadableStream<Uint8Array>) {
    const file = this.path(ticket.key);
    await mkdir(dirname(file), { recursive: true });
    const partial = `${file}.part`;
    let seen = 0;
    const count = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        seen += chunk.length;
        done(seen > ticket.bytes ? new Error("Upload is larger than declared.") : null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>), count, createWriteStream(partial));
      if (seen !== ticket.bytes) throw new Error("Upload is smaller than declared.");
      await rename(partial, file);
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }
  }

  async head(key: string) {
    try {
      const s = await stat(this.path(key));
      return s.isFile() ? { size: s.size, contentType: contentTypeOf(key) } : null;
    } catch {
      return null;
    }
  }

  async download(key: string, toPath: string) {
    await copyFile(this.path(key), toPath);
  }

  async upload(key: string, fromPath: string) {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await copyFile(fromPath, file);
  }

  async remove(key: string) {
    await rm(this.path(key), { force: true });
  }

  publicUrl(key: string) {
    return `${this.options.baseUrl}/${key}`;
  }
}
