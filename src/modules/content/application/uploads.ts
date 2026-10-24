import { domainError, err, ok, type Clock, type DomainError, type EventLog, type ObjectStorage, type Result } from "@/shared/kernel";
import type { VideoRepository } from "../domain/repositories";
import { draftVideo, encoded, fail, MAX_UPLOAD_BYTES, UPLOAD_TYPES, type VideoEncoded, type VideoError, type VideoStatus } from "../domain/video";
import type { Actor, ProductDirectory } from "./interactions";

/** Turns an uploaded file into renditions and a poster, stored under `videos/<id>/`. */
export interface VideoEncoder {
  /**
   * A permanent problem with the file comes back as an error (the video is marked failed);
   * outages throw (the video is retried later).
   */
  encode(input: { videoId: string; sourceKey: string; contentType: string }): Promise<Result<VideoEncoded, EncodeError>>;
}

export type EncodeError = DomainError<"unreadable" | "too_long" | "no_video">;
export type UploadError = DomainError<"unsupported_type" | "too_large" | "not_found" | "forbidden" | "conflict"> | VideoError;

export type UploadDeps = {
  storage: Pick<ObjectStorage, "signUpload" | "head">;
  videos: VideoRepository;
  products: ProductDirectory;
  encoder: VideoEncoder;
  /** The video and its event commit together. */
  uow: { run<T>(work: (scope: { videos: VideoRepository; events: EventLog }) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
  /** Production holds new uploads for a moderator; development publishes them straight away. */
  premoderated: boolean;
};

/** A creator's own video as their dashboard shows it. */
export type MyVideoView = {
  id: string;
  status: VideoStatus;
  caption: string;
  image: string;
  productSlug: string;
  views: number;
  likes: number;
  /** ISO time it was uploaded. */
  at: string;
};

/** Upload tickets last long enough for a slow phone connection. */
const TICKET_SECONDS = 30 * 60;
/** Encoding a few minutes of video on a small server can take a while. */
export const ENCODE_LEASE_MS = 15 * 60_000;
export const ENCODE_ATTEMPTS = 3;

/** Posting videos: an upload ticket, publishing the upload, and the encoding queue. */
export function makeUploads({ storage, videos, products, encoder, uow, clock, newId, premoderated }: UploadDeps) {
  const prefix = (accountId: string) => `uploads/${accountId}/`;

  return {
    /** Where the browser sends the file. Its type and exact size are fixed by the ticket. */
    async startUpload(actor: Actor, file: { contentType: string; bytes: number }): Promise<Result<{ key: string; url: string; method: "PUT"; headers: Readonly<Record<string, string>> }, UploadError>> {
      const ext = UPLOAD_TYPES[file.contentType];
      if (!ext) return err(domainError("unsupported_type", "Upload an MP4, MOV or WebM video."));
      if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > MAX_UPLOAD_BYTES) {
        return err(domainError("too_large", `Videos can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`));
      }
      const key = `${prefix(actor.accountId)}${newId()}.${ext}`;
      const ticket = await storage.signUpload(key, file, TICKET_SECONDS);
      return ok({ key, ...ticket });
    },

    /** The upload has landed: the video joins the encoding queue. */
    async publish(
      actor: Actor,
      input: { key: string; productSlug: string; alsoSlugs: readonly string[]; caption: string; tags: readonly string[]; place: string },
    ): Promise<Result<{ videoId: string }, UploadError>> {
      if (!input.key.startsWith(prefix(actor.accountId))) return err(domainError("forbidden", "That upload isn't yours."));
      const [stored, product, taken] = await Promise.all([storage.head(input.key), products.find(input.productSlug), videos.hasSource(input.key)]);
      if (!stored) return err(domainError("not_found", "The upload didn't finish. Try again."));
      if (!product) return err(domainError("not_found", "That product isn't for sale any more."));
      if (taken) return err(domainError("conflict", "This upload is already posted."));
      const also = await Promise.all(input.alsoSlugs.map((slug) => products.find(slug)));
      const at = clock.now();
      const drafted = draftVideo({
        id: newId(),
        authorId: actor.accountId,
        sellerId: product.sellerId,
        productSlug: product.slug,
        alsoSlugs: also.flatMap((p) => (p ? [p.slug] : [])),
        category: product.category,
        caption: input.caption,
        tags: input.tags,
        place: input.place,
        sourceKey: input.key,
        at,
      });
      if (!drafted.ok) return drafted;
      const { video, event } = drafted.value;
      await uow.run(async (s) => {
        await s.videos.save(video);
        await s.events.record(video.id, event);
      });
      return ok({ videoId: video.id });
    },

    /**
     * Encodes the next waiting video, if any. Returns what happened, or null when the
     * queue is empty. Safe to run on several workers: each claim is leased.
     */
    async encodeNext(): Promise<{ videoId: string; status: VideoStatus } | null> {
      const now = clock.now();
      const claimed = await videos.claimForEncoding(now, new Date(now.getTime() + ENCODE_LEASE_MS), ENCODE_ATTEMPTS);
      if (!claimed) return null;
      const { video, attempt } = claimed;
      let result: Awaited<ReturnType<VideoEncoder["encode"]>>;
      try {
        const contentType = Object.entries(UPLOAD_TYPES).find(([, ext]) => video.sourceKey?.endsWith(`.${ext}`))?.[0] ?? "video/mp4";
        result = await encoder.encode({ videoId: video.id, sourceKey: video.sourceKey ?? "", contentType });
      } catch (error) {
        // An outage, not the file's fault: try again later, then give up.
        if (attempt >= ENCODE_ATTEMPTS) {
          await videos.save(fail(video));
          return { videoId: video.id, status: "failed" };
        }
        await videos.releaseEncoding(video.id, error instanceof Error ? error.message : String(error), new Date(clock.now().getTime() + 60_000 * attempt));
        return { videoId: video.id, status: "processing" };
      }
      if (!result.ok) {
        await videos.save(fail(video));
        return { videoId: video.id, status: "failed" };
      }
      // Encoders that can't grab a frame leave the poster empty; the product photo stands in.
      const media = result.value.posterUrl ? result.value : { ...result.value, posterUrl: (await products.find(video.productSlug))?.image ?? "" };
      const done = encoded(video, media, clock.now(), { premoderated });
      if (!done.ok) return { videoId: video.id, status: video.status };
      await uow.run(async (s) => {
        await s.videos.save(done.value.video);
        if (done.value.event) await s.events.record(video.id, done.value.event);
      });
      return { videoId: video.id, status: done.value.video.status };
    },

    async mine(accountId: string): Promise<MyVideoView[]> {
      const list = await videos.listByAuthor(accountId, 60);
      const stats = await videos.stats(list.map((v) => v.id));
      return list.map((v) => ({
        id: v.id,
        status: v.status,
        caption: v.caption,
        image: v.posterUrl,
        productSlug: v.productSlug,
        views: stats.get(v.id)?.views ?? 0,
        likes: stats.get(v.id)?.likes ?? 0,
        at: v.createdAt.toISOString(),
      }));
    },
  };
}

export type Uploads = ReturnType<typeof makeUploads>;
