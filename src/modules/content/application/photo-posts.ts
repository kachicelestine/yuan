import { domainError, err, ok, type Clock, type DomainError, type ObjectStorage, type Result } from "@/shared/kernel";
import { draftNote, type Note, type NoteError } from "../domain/posts";
import type { NoteRepository } from "../domain/repositories";
import type { Actor, ProductDirectory } from "./interactions";
import { toNoteView, type NoteView } from "./views";

export type PhotoPostDeps = {
  storage: Pick<ObjectStorage, "signUpload" | "head">;
  notes: NoteRepository;
  products: ProductDirectory;
  clock: Clock;
  newId: () => string;
  /** Hold new posts for a moderator. */
  premoderated: boolean;
};

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export type PhotoPostError = NoteError | DomainError<"unsupported_type" | "too_large" | "not_found">;

/** Photo posts: anyone posts a photo with a caption and hashtags, optionally tagging a product. */
export function makePhotoPosts({ storage, notes, products, clock, newId, premoderated }: PhotoPostDeps) {
  return {
    /** A ticket to upload the photo straight to storage. */
    async startPhoto(actor: Actor, file: { contentType: string; bytes: number }): Promise<Result<{ url: string; method: "PUT"; headers: Readonly<Record<string, string>>; photo: string }, PhotoPostError>> {
      const ext = PHOTO_TYPES[file.contentType];
      if (!ext) return err(domainError("unsupported_type", "Upload a JPEG, PNG or WebP photo."));
      if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > MAX_PHOTO_BYTES) return err(domainError("too_large", "Photos can be up to 12 MB."));
      const key = `notes/${actor.accountId}/${newId()}.${ext}`;
      const ticket = await storage.signUpload(key, file, 15 * 60);
      return ok({ ...ticket, photo: `/media/${key}` });
    },

    /** Posts it to Discover (and the person's profile and hashtag pages). */
    async post(actor: Actor, input: { photo: string; caption: string; tags: readonly string[]; productSlug: string | null; ratio: Note["ratio"] }): Promise<Result<NoteView & { inReview: boolean }, PhotoPostError>> {
      const product = input.productSlug ? await products.find(input.productSlug) : null;
      if (input.productSlug && !product) return err(domainError("not_found", "That product isn't for sale any more."));
      const drafted = draftNote({
        id: `n-${newId()}`,
        author: actor,
        imageUrl: input.photo,
        ratio: input.ratio,
        productSlug: product?.slug ?? null,
        category: product?.category ?? "lifestyle",
        caption: input.caption,
        tags: input.tags,
        inReview: premoderated,
        at: clock.now(),
      });
      if (!drafted.ok) return drafted;
      if (!(await storage.head(input.photo.slice("/media/".length)))) return err(domainError("invalid_photo", "The photo didn't finish uploading. Try again."));
      await notes.add(drafted.value);
      return ok({ ...toNoteView(drafted.value), inReview: drafted.value.inReview });
    },
  };
}

export type PhotoPosts = ReturnType<typeof makePhotoPosts>;
