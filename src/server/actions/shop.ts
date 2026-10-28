"use server";

import { revalidateTag, updateTag } from "next/cache";
import { z } from "zod";
import { centsOrNull, type ListingView } from "@/modules/catalog";
import { money } from "@/shared/kernel";
import { CATALOG_TAG, productTag, questionsTag, sellerTag } from "../cache-tags";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentShop } from "../shop";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

/** The signed-in person's shop, rate-limited; or why not. */
async function shop(sellerId?: string) {
  const s = await currentShop(sellerId);
  if (!s) return { allowed: false as const, error: fail("forbidden", "Open your shop first.") };
  if (!(await allow("account.write", s.account.id))) return { allowed: false as const, error: RATE_LIMITED as Failure };
  return { allowed: true as const, ...s, app: await services() };
}

/**
 * The seller sees their change straight away on the listing and shop pages (updateTag
 * expires those now); category pages and search refresh in the background.
 */
function refresh(sellerId: string, slug?: string) {
  if (slug) updateTag(productTag(slug));
  updateTag(sellerTag(sellerId));
  revalidateTag(CATALOG_TAG, "max");
}

export async function startPhotoAction(kind: "catalog" | "shops", file: { contentType: string; bytes: number }): Promise<{ ok: true; url: string; headers: Record<string, string>; photo: string } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const parsed = z.object({ contentType: z.string().max(100), bytes: z.number().int().positive() }).safeParse(file);
  if (!parsed.success || (kind !== "catalog" && kind !== "shops")) return fail("invalid", "That file couldn't be read.");
  const r = await s.app.selling.startPhoto(s.sellerId, kind, parsed.data);
  return r.ok ? { ok: true, url: r.value.url, headers: { ...r.value.headers }, photo: r.value.photo } : fail(r.error.code, r.error.message);
}

const dollars = z.number().positive().max(1_000_000);
const text = (max: number) => z.string().max(max);

// What the listing form sends: dollars and days, as people think of them.
const Listing = z.object({
  title: text(200),
  categoryId: text(60),
  images: z.array(text(300)).max(12),
  price: dollars.nullable(),
  was: dollars.nullable(),
  tiers: z.array(z.object({ min: z.number().int().min(1).max(1_000_000), price: dollars })).max(8),
  minOrder: z.number().int().min(1).max(1_000_000),
  options: z
    .array(z.object({ name: text(40), values: z.array(z.object({ label: text(60), sub: text(80).nullable(), delta: z.number().min(0).max(100_000).nullable(), soldOut: z.boolean().optional() })).min(1).max(30) }))
    .max(4),
  /** Units to sell; null when the shop doesn't count them. */
  stock: z.number().int().min(0).max(1_000_000).nullable().optional(),
  highlights: z.array(text(80)).max(12),
  specs: z.array(z.tuple([text(60), text(200)])).max(40),
  shipsFrom: text(80),
  leadMinDays: z.number().int().min(1).max(365),
  leadMaxDays: z.number().int().min(1).max(365),
  status: z.enum(["draft", "active"]),
});

export async function saveListingAction(input: z.input<typeof Listing>, productId?: string): Promise<{ ok: true; listing: ListingView } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const parsed = Listing.safeParse(input);
  if (!parsed.success) return fail("invalid", "Check the listing and try again.");
  const l = parsed.data;
  const id = productId ? z.uuid().catch("").parse(productId) : "";
  const before = id ? await s.app.selling.listing(s.sellerId, id) : null;
  const r = await s.app.selling.save(
    s.sellerId,
    {
      title: l.title,
      categoryId: l.categoryId,
      images: l.images,
      price: centsOrNull(l.price),
      was: centsOrNull(l.was),
      tiers: l.tiers.map((t) => ({ minQty: t.min, price: money.fromDollars(t.price) })),
      minOrder: l.minOrder,
      options: l.options.map((o) => ({
        name: o.name.trim(),
        defaultIndex: 0,
        values: o.values.map((v) => ({ label: v.label.trim(), sub: v.sub?.trim() || null, delta: money.fromDollars(v.delta ?? 0), swatch: null, ...(v.soldOut && { soldOut: true }) })),
      })),
      stock: l.stock,
      highlights: l.highlights,
      specs: l.specs,
      shipsFrom: l.shipsFrom,
      leadTime: { minDays: l.leadMinDays, maxDays: Math.max(l.leadMinDays, l.leadMaxDays) },
      dutyRate: null,
      status: l.status,
    },
    productId ? z.uuid().catch("").parse(productId) || "missing" : undefined,
  );
  if (!r.ok) return fail(r.error.code, r.error.message);
  refresh(s.sellerId, r.value.slug);
  // Back in stock: tell the people waiting for it.
  if (before?.stock === 0 && r.value.status === "active" && (r.value.stock === undefined || r.value.stock > 0)) {
    const watchers = await s.app.engagement.watchersOf(r.value.slug);
    if (watchers.length)
      await s.app.notifications.notify(watchers, { kind: "restock", title: "Back in stock", body: `${r.value.title} is back. Get it before it goes again.`, link: `/p/${r.value.slug}`, email: true }, `restock:${r.value.slug}:${Date.now()}`);
  }
  return { ok: true, listing: r.value };
}

export async function setListingStatusAction(productId: string, status: "draft" | "active" | "archived"): Promise<{ ok: true; listing: ListingView } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const parsed = z.object({ id: z.uuid(), status: z.enum(["draft", "active", "archived"]) }).safeParse({ id: productId, status });
  if (!parsed.success) return fail("invalid", "No such listing.");
  const r = await s.app.selling.setStatus(s.sellerId, parsed.data.id, parsed.data.status);
  if (!r.ok) return fail(r.error.code, r.error.message);
  refresh(s.sellerId, r.value.slug);
  return { ok: true, listing: r.value };
}

const Storefront = z.object({
  bio: text(2000),
  cover: text(300).nullable(),
  avatar: text(300).nullable(),
  certificates: z.array(text(60)).max(20),
  capacity: text(120).nullable(),
  staff: z.number().int().nullable(),
  floorArea: text(60).nullable(),
  exportsTo: z.array(text(4)).max(80),
});

export async function updateStorefrontAction(input: z.input<typeof Storefront>): Promise<{ ok: true } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const parsed = Storefront.safeParse(input);
  if (!parsed.success) return fail("invalid", "Check the form and try again.");
  const r = await s.app.selling.updateStorefront(s.sellerId, parsed.data);
  if (!r.ok) return fail(r.error.code, r.error.message);
  refresh(s.sellerId);
  return { ok: true };
}

/** The shop sent its parcel. */
export async function shipAction(orderId: string, carrier: string, tracking: string): Promise<{ ok: true } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const p = z.object({ orderId: z.uuid(), carrier: text(40), tracking: text(60) }).safeParse({ orderId, carrier, tracking });
  if (!p.success) return fail("invalid", "Add the carrier and tracking number.");
  const r = await s.app.fulfilment.ship(s.sellerId, p.data.orderId, { carrier: p.data.carrier, tracking: p.data.tracking });
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** Withdraw part or all of the available balance to the shop's wallet. */
export async function requestPayoutAction(dollarsAmount: number): Promise<{ ok: true } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const p = z.number().positive().max(10_000_000).safeParse(dollarsAmount);
  if (!p.success) return fail("invalid", "Enter an amount.");
  if (s.role !== "owner") return fail("forbidden", "Only the shop's owner can withdraw.");
  const r = await s.app.escrow.requestPayout(s.sellerId, money.fromDollars(p.data));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** The share of each order the shop pays creators who bring it in (0 leaves the programme). */
export async function setCreatorRateAction(rate: number): Promise<{ ok: true } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  if (s.role !== "owner") return fail("forbidden", "Only the shop's owner can change this.");
  const r = await s.app.affiliates.setRate(s.sellerId, z.number().catch(-1).parse(rate));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** Offer free samples of a listing to creators. */
export async function createSampleOfferAction(slug: string, quantity: number): Promise<{ ok: true } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const p = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/), quantity: z.number().int() }).safeParse({ slug, quantity });
  if (!p.success) return fail("invalid_offer", "Pick a listing and how many.");
  const r = await s.app.samples.createOffer(s.sellerId, p.data.slug, p.data.quantity);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

export async function setSampleOfferActiveAction(id: string, active: boolean): Promise<{ ok: true } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const o = z.uuid().safeParse(id);
  if (!o.success) return fail("not_found", "No such offer.");
  const r = await s.app.samples.setOfferActive(s.sellerId, o.data, active === true);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** The shop sent a creator's sample: carrier and tracking number. */
export async function shipSampleAction(id: string, carrier: string, tracking: string): Promise<{ ok: true } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const r = await s.app.samples.ship(s.sellerId, z.uuid().catch("").parse(id), { carrier: z.string().max(80).catch("").parse(carrier), tracking: z.string().max(80).catch("").parse(tracking) });
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

export async function declineSampleAction(id: string, reason: string): Promise<{ ok: true } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const r = await s.app.samples.decline(s.sellerId, z.uuid().catch("").parse(id), z.string().max(600).catch("").parse(reason));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

export async function answerQuestionAction(questionId: string, answer: string): Promise<{ ok: true } | Failure> {
  const s = await shop();
  if (!s.allowed) return s.error;
  const id = z.string().min(1).max(64).safeParse(questionId);
  if (!id.success) return fail("invalid", "No such question.");
  const r = await s.app.interactions.answerQuestion(s.sellerId, id.data, z.string().max(4000).catch("").parse(answer));
  if (!r.ok) return fail(r.error.code, r.error.message);
  updateTag(questionsTag(r.value.productSlug));
  return { ok: true };
}
