import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AwsClient, AwsV4Signer } from "aws4fetch";
import { isStorageKey, type ObjectStorage, type SignedUpload } from "@/shared/kernel";

export type R2Options = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** The bucket's public domain, e.g. https://media.example.com (R2 custom domain: no egress fees). Empty for private buckets. */
  publicUrl: string;
};

/**
 * Cloudflare R2 through its S3 API. Browsers upload straight to the bucket with a
 * presigned PUT whose signature covers the content type and exact length, so a ticket
 * for a 40 MB video can't carry 4 GB. The bucket needs a CORS rule allowing PUT from
 * the site (see deploy/README.md).
 */
export class R2Storage implements ObjectStorage {
  private readonly client: AwsClient;
  private readonly endpoint: string;

  constructor(private readonly options: R2Options) {
    this.client = new AwsClient({ accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey, service: "s3", region: "auto" });
    this.endpoint = `https://${options.accountId}.r2.cloudflarestorage.com/${options.bucket}`;
  }

  private url(key: string) {
    if (!isStorageKey(key)) throw new Error(`Bad storage key: ${key}`);
    return `${this.endpoint}/${key}`;
  }

  async signUpload(key: string, file: { contentType: string; bytes: number }, expiresInSeconds: number): Promise<SignedUpload> {
    const url = new URL(this.url(key));
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    const signed = await new AwsV4Signer({
      method: "PUT",
      url: url.toString(),
      headers: { "content-type": file.contentType, "content-length": String(file.bytes) },
      accessKeyId: this.options.accessKeyId,
      secretAccessKey: this.options.secretAccessKey,
      service: "s3",
      region: "auto",
      signQuery: true,
      allHeaders: true,
    }).sign();
    // The browser sets Content-Length itself from the file; it only needs to send the type.
    return { url: signed.url.toString(), method: "PUT", headers: { "content-type": file.contentType } };
  }

  async head(key: string) {
    const res = await this.client.fetch(this.url(key), { method: "HEAD" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 HEAD ${key}: ${res.status}`);
    return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }

  async read(key: string) {
    const res = await this.client.fetch(this.url(key));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 GET ${key}: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async download(key: string, toPath: string) {
    const res = await this.client.fetch(this.url(key));
    if (!res.ok || !res.body) throw new Error(`R2 GET ${key}: ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream<Uint8Array>), createWriteStream(toPath));
  }

  async upload(key: string, fromPath: string, contentType: string) {
    // Encoded renditions and posters are tens of megabytes at most, so one buffer is fine.
    const body = await readFile(fromPath);
    const res = await this.client.fetch(this.url(key), {
      method: "PUT",
      body,
      headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
    });
    if (!res.ok) throw new Error(`R2 PUT ${key}: ${res.status} ${await res.text()}`);
  }

  async remove(key: string) {
    const res = await this.client.fetch(this.url(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${key}: ${res.status}`);
  }

  async signDownload(key: string, expiresInSeconds: number) {
    const url = new URL(this.url(key));
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    const signed = await this.client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return signed.url;
  }

  publicUrl(key: string) {
    return `${this.options.publicUrl.replace(/\/$/, "")}/${key}`;
  }
}
