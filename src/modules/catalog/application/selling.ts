import { domainError, err, money, ok, type Cents, type Clock, type DomainError, type ObjectStorage, type Result } from "@/shared/kernel";
import type { CategoryId } from "../domain/category";
import { createProduct, isLocked, type LeadTime, type Product, type ProductError, type ProductOption, type ProductStatus, type Tier } from "../domain/product";
import type { CategoryRepository, ProductRepository, SellerRepository } from "../domain/repositories";
import type { SellerId, Storefront } from "../domain/seller";
import { toProductView, type ProductView } from "./views";

export type SellingDeps = {
  products: ProductRepository;
  categories: CategoryRepository;
  sellers: SellerRepository;
  /** Public storage for listing and shop photos. */
  photos: Pick<ObjectStorage, "signUpload" | "head">;
  clock: Clock;
  newId: () => string;
};

/** What a seller fills in. Money is in cents; ratings, reviews and sales are earned, never typed. */
export type ListingInput = Readonly<{
  title: string;
  categoryId: string;
  images: readonly string[];
  price: Cents | null;
  was: Cents | null;
  tiers: readonly Tier[];
  minOrder: number;
  options: readonly ProductOption[];
  highlights: readonly string[];
  specs: readonly (readonly [string, string])[];
  shipsFrom: string;
  leadTime: LeadTime;
  /** Import duty as a share of the price; null uses what similar listings in the category pay. */
  dutyRate: number | null;
  status: "draft" | "active";
}>;

export type ListingView = ProductView & { status: ProductStatus; moderationNote: string | null };

export type StorefrontInput = Readonly<{
  bio: string;
  cover: string | null;
  avatar: string | null;
  certificates: readonly string[];
  capacity: string | null;
  staff: number | null;
  floorArea: string | null;
  exportsTo: readonly string[];
}>;

export type SellingError = ProductError | DomainError<"not_found" | "forbidden" | "unknown_category" | "invalid_image" | "unsupported_type" | "too_large" | "invalid_storefront">;

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_IMAGES = 9;

/** "Heavyweight hoodie, 480 g" → "heavyweight-hoodie-480-g". */
export function slugify(title: string) {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "item"
  );
}

/** Photos a shop uploaded live under /media/<kind>/<shop>/…; nothing else may be linked. */
const ownPhoto = (sellerId: string, kind: "catalog" | "shops", url: string) => url.startsWith(`/media/${kind}/${sellerId}/`) && !url.includes("..");

/** A shop managing its own listings and storefront. Every call is scoped to one shop. */
export function makeSelling({ products, categories, sellers, photos, clock, newId }: SellingDeps) {
  const view = (p: Product): ListingView => ({ ...toProductView(p, clock.now()), status: p.status, moderationNote: p.moderationNote ?? null });

  async function owned(sellerId: string, productId: string) {
    const p = await products.findById(productId);
    return p && p.sellerId === sellerId ? p : null;
  }

  /** The usual duty for a category: the median of its listings, or 10% when it has none. */
  async function categoryDuty(categoryId: CategoryId) {
    const rates = (await products.list({ categoryId })).map((p) => p.dutyRate).sort((a, b) => a - b);
    return rates.length ? rates[Math.floor(rates.length / 2)] : 0.1;
  }

  async function freeSlug(title: string) {
    const base = slugify(title);
    if (!(await products.slugExists(base))) return base;
    for (let i = 0; i < 5; i++) {
      const candidate = `${base}-${newId().replace(/-/g, "").slice(-5)}`;
      if (!(await products.slugExists(candidate))) return candidate;
    }
    return `${base}-${newId().replace(/-/g, "")}`;
  }

  return {
    async listings(sellerId: string): Promise<ListingView[]> {
      return (await products.listBySeller(sellerId as SellerId)).map(view);
    },

    async listing(sellerId: string, productId: string): Promise<ListingView | null> {
      const p = await owned(sellerId, productId);
      return p && view(p);
    },

    /** A ticket to upload one photo for a listing ("catalog") or the storefront ("shops"). */
    async startPhoto(sellerId: string, kind: "catalog" | "shops", file: { contentType: string; bytes: number }): Promise<Result<{ url: string; method: "PUT"; headers: Readonly<Record<string, string>>; photo: string }, SellingError>> {
      const ext = PHOTO_TYPES[file.contentType];
      if (!ext) return err(domainError("unsupported_type", "Upload a JPEG, PNG or WebP photo."));
      if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > MAX_PHOTO_BYTES) return err(domainError("too_large", "Photos can be up to 12 MB."));
      const key = `${kind}/${sellerId}/${newId()}.${ext}`;
      const ticket = await photos.signUpload(key, file, 15 * 60);
      // Stored as a site path; /media serves it (or redirects to the bucket) and /img/m resizes it.
      return ok({ ...ticket, photo: `/media/${key}` });
    },

    /** Creates a listing, or updates one this shop owns. Earned numbers (rating, sales) are kept. */
    async save(sellerId: string, input: ListingInput, productId?: string): Promise<Result<ListingView, SellingError>> {
      const existing = productId ? await owned(sellerId, productId) : null;
      if (productId && !existing) return err(domainError("not_found", "That listing isn't yours or no longer exists."));
      if (!(await categories.findById(input.categoryId as CategoryId))) return err(domainError("unknown_category", "Pick a category."));

      const images = input.images.slice(0, MAX_IMAGES);
      const kept = new Set(existing?.images ?? []);
      for (const url of images) {
        if (!kept.has(url) && !ownPhoto(sellerId, "catalog", url)) return err(domainError("invalid_image", "Upload photos here rather than linking them."));
        if (!kept.has(url) && !(await photos.head(url.slice("/media/".length)))) return err(domainError("invalid_image", "A photo didn't finish uploading. Add it again."));
      }

      const made = createProduct({
        id: existing?.id ?? newId(),
        slug: existing?.slug ?? (await freeSlug(input.title)),
        title: input.title.trim(),
        categoryId: input.categoryId as CategoryId,
        sellerId: sellerId as SellerId,
        // A listing a moderator removed, or of a suspended shop, keeps that status.
        status: existing && isLocked(existing.status) ? existing.status : existing?.status === "archived" && input.status === "draft" ? "archived" : input.status,
        moderationNote: existing?.moderationNote ?? null,
        images,
        price: input.price,
        was: input.was,
        tiers: input.tiers,
        minOrder: input.minOrder,
        rating: existing?.rating ?? 0,
        reviewCount: existing?.reviewCount ?? 0,
        soldCount: existing?.soldCount ?? null,
        options: input.options,
        highlights: input.highlights.map((h) => h.trim()).filter(Boolean).slice(0, 8),
        specs: input.specs.filter(([k, v]) => k.trim() && v.trim()).slice(0, 30),
        buyersSay: existing?.buyersSay ?? null,
        shipsFrom: input.shipsFrom.trim(),
        leadTime: input.leadTime,
        dutyRate: input.dutyRate ?? existing?.dutyRate ?? (await categoryDuty(input.categoryId as CategoryId)),
      });
      if (!made.ok) return made;
      await products.save(made.value);
      return ok(view(made.value));
    },

    async setStatus(sellerId: string, productId: string, status: ProductStatus): Promise<Result<ListingView, SellingError>> {
      const p = await owned(sellerId, productId);
      if (!p) return err(domainError("not_found", "That listing isn't yours or no longer exists."));
      if (isLocked(p.status) || isLocked(status)) return err(domainError("not_found", p.status === "removed" ? "Moderators removed this listing. Write to support to have it reviewed." : "Your shop is suspended."));
      const next = { ...p, status };
      await products.save(next);
      return ok(view(next));
    },

    async storefront(sellerId: string) {
      return sellers.findById(sellerId as SellerId);
    },

    async updateStorefront(sellerId: string, input: StorefrontInput): Promise<Result<true, SellingError>> {
      const seller = await sellers.findById(sellerId as SellerId);
      if (!seller) return err(domainError("not_found", "No such shop."));
      const bio = input.bio.trim();
      if (bio.length < 20 || bio.length > 1000) return err(domainError("invalid_storefront", "Write a bio of 20 to 1,000 characters."));
      for (const url of [input.cover, input.avatar]) {
        if (url && url !== seller.storefront?.cover && url !== seller.avatar && !ownPhoto(sellerId, "shops", url)) return err(domainError("invalid_image", "Upload photos here rather than linking them."));
      }
      if (input.staff !== null && (!Number.isInteger(input.staff) || input.staff < 1 || input.staff > 1_000_000)) return err(domainError("invalid_storefront", "Staff should be a whole number."));
      const exportsTo = [...new Set(input.exportsTo.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))].slice(0, 60);
      const current: Storefront = seller.storefront ?? { cover: "", bio: "", followers: 0, rating: 0, responseHours: 24, onTimeRate: 1, certificates: [], capacity: null, staff: null, floorArea: null, exportsTo: [] };
      await sellers.save({
        ...seller,
        avatar: input.avatar ?? seller.avatar,
        storefront: {
          ...current,
          bio,
          cover: input.cover ?? current.cover,
          certificates: input.certificates.map((c) => c.trim()).filter(Boolean).slice(0, 12),
          capacity: input.capacity?.trim() || null,
          staff: input.staff,
          floorArea: input.floorArea?.trim() || null,
          exportsTo,
        },
      });
      return ok(true);
    },
  };
}

export type Selling = ReturnType<typeof makeSelling>;

/** Dollars from a form to cents, or null when left empty. */
export const centsOrNull = (dollars: number | null | undefined) => (dollars === null || dollars === undefined ? null : money.fromDollars(dollars));
