/** What's stored under a key. */
export type StoredObject = Readonly<{ size: number; contentType: string }>;

/** A short-lived place the browser uploads one file to, straight to storage. */
export type SignedUpload = Readonly<{ url: string; method: "PUT"; headers: Readonly<Record<string, string>> }>;

/**
 * Files by key (uploads, encoded videos, posters). Development keeps them on disk; production
 * uses an S3-compatible bucket (Cloudflare R2) served from its own domain.
 */
export interface ObjectStorage {
  /** A URL the browser PUTs exactly `bytes` bytes of `contentType` to; anything else is refused. */
  signUpload(key: string, file: { contentType: string; bytes: number }, expiresInSeconds: number): Promise<SignedUpload>;
  head(key: string): Promise<StoredObject | null>;
  /** Copies an object to a local file (for encoders that need one). */
  download(key: string, toPath: string): Promise<void>;
  upload(key: string, fromPath: string, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** Where people's browsers fetch the object from. */
  publicUrl(key: string): string;
}

/** Keys are plain paths: lower-case letters, digits, "-", "_", "." and "/" (no "..", no leading "/"). */
export const isStorageKey = (key: string) => /^[a-z0-9][a-z0-9/_.-]{0,255}$/.test(key) && !key.includes("..") && !key.includes("//");
