import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

/** processing → (review →) ready. "review" waits for a moderator when uploads are pre-moderated. */
export type VideoStatus = "processing" | "review" | "ready" | "failed" | "removed";

/** One encoded version of a clip; players pick by screen and connection. */
export type Rendition = Readonly<{ height: number; url: string; bitrateKbps: number }>;

/** Where a tagged product sits in the frame, as percentages of a 9:19.5 crop. */
export type Spot = Readonly<{ slug: string; x: number; y: number }>;

/** A shoppable short video: one main product, optionally a "look" of more. */
export type Video = Readonly<{
  id: string;
  /** The account that posted it; null for catalog videos loaded from seed data. */
  authorId: string | null;
  /** The shop it sells for. */
  sellerId: string;
  productSlug: string;
  alsoSlugs: readonly string[];
  /** The main product's category, kept here so category pages don't need the catalog. */
  category: string;
  spots: readonly Spot[];
  posterUrl: string;
  renditions: readonly Rendition[];
  /** The original upload in object storage, kept for re-encoding. */
  sourceKey: string | null;
  durationMs: number | null;
  /** Bright footage needs darker glass over it. */
  tone: "light" | "dark";
  caption: string;
  tags: readonly string[];
  place: string;
  status: VideoStatus;
  createdAt: Date;
  publishedAt: Date | null;
}>;

export type VideoError = DomainError<"invalid_caption" | "too_many_products" | "too_many_tags" | "not_processing" | "not_in_review">;

export const MAX_CAPTION = 2200;
export const MAX_TAGGED = 6;
export const MAX_TAGS = 10;
/** Uploads: phone footage up to three minutes fits comfortably. */
export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
export const MAX_DURATION_MS = 3 * 60_000;
/** What phones record (MP4/MOV) and what browsers export (WebM), with their file extensions. */
export const UPLOAD_TYPES: Readonly<Record<string, string>> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

export type VideoUploaded = Readonly<{ type: "VideoUploaded"; videoId: string; sourceKey: string; at: Date }>;
export type VideoPublished = Readonly<{ type: "VideoPublished"; videoId: string; sellerId: string; category: string; authorId: string | null; at: Date }>;

/** A new upload, waiting for its renditions. Hashtags are normalised: lower case, no "#". */
export function draftVideo(props: {
  id: string;
  authorId: string;
  sellerId: string;
  productSlug: string;
  alsoSlugs: readonly string[];
  category: string;
  caption: string;
  tags: readonly string[];
  place: string;
  sourceKey: string;
  at: Date;
}): Result<{ video: Video; event: VideoUploaded }, VideoError> {
  const caption = props.caption.trim();
  if (caption.length === 0 || caption.length > MAX_CAPTION) return err(domainError("invalid_caption", `Write a caption of up to ${MAX_CAPTION} characters.`));
  const also = [...new Set(props.alsoSlugs.filter((s) => s !== props.productSlug))];
  if (also.length + 1 > MAX_TAGGED) return err(domainError("too_many_products", `Tag up to ${MAX_TAGGED} products.`));
  const tags = [...new Set(props.tags.map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))];
  if (tags.length > MAX_TAGS) return err(domainError("too_many_tags", `Use up to ${MAX_TAGS} tags.`));
  const video: Video = {
    id: props.id,
    authorId: props.authorId,
    sellerId: props.sellerId,
    productSlug: props.productSlug,
    alsoSlugs: also,
    category: props.category,
    spots: [],
    posterUrl: "",
    renditions: [],
    sourceKey: props.sourceKey,
    durationMs: null,
    tone: "dark",
    caption,
    tags,
    place: props.place.trim().slice(0, 80),
    status: "processing",
    createdAt: props.at,
    publishedAt: null,
  };
  return ok({ video, event: { type: "VideoUploaded", videoId: video.id, sourceKey: props.sourceKey, at: props.at } });
}

export type VideoEncoded = Readonly<{ posterUrl: string; renditions: readonly Rendition[]; durationMs: number; tone: "light" | "dark" }>;

/**
 * Encoding finished. The video goes live, or waits for a moderator when uploads are
 * pre-moderated (then `approve` publishes it). The event is null until it's live.
 */
export function encoded(video: Video, media: VideoEncoded, at: Date, options: { premoderated: boolean }): Result<{ video: Video; event: VideoPublished | null }, VideoError> {
  if (video.status !== "processing") return err(domainError("not_processing", `Video ${video.id} is ${video.status}.`));
  const renditions = [...media.renditions].sort((a, b) => a.height - b.height);
  const withMedia: Video = { ...video, ...media, renditions };
  if (options.premoderated) return ok({ video: { ...withMedia, status: "review" }, event: null });
  return ok(goLive(withMedia, at));
}

/** A moderator let a video through. */
export function approve(video: Video, at: Date): Result<{ video: Video; event: VideoPublished }, VideoError> {
  if (video.status !== "review") return err(domainError("not_in_review", `Video ${video.id} is ${video.status}.`));
  return ok(goLive(video, at));
}

const goLive = (video: Video, at: Date) => ({
  video: { ...video, status: "ready" as const, publishedAt: at },
  event: { type: "VideoPublished" as const, videoId: video.id, sellerId: video.sellerId, category: video.category, authorId: video.authorId, at },
});

/** Encoding gave up (unreadable file, too long, no video track). */
export function fail(video: Video): Video {
  return video.status === "processing" ? { ...video, status: "failed" } : video;
}

/** The best rendition that fits a screen height, or the smallest one. */
export function renditionFor(renditions: readonly Rendition[], height: number): Rendition | undefined {
  const fit = renditions.filter((r) => r.height <= height);
  return fit.at(-1) ?? renditions[0];
}

export function remove(video: Video): Video {
  return { ...video, status: "removed" };
}
