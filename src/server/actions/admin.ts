"use server";

import { revalidateTag, updateTag } from "next/cache";
import { z } from "zod";
import { REPORT_TARGETS } from "@/modules/content";
import { recordAdmin, type AdminAction } from "../admin/audit";
import { accountEmail, campaignSeller } from "../admin/queries";
import { CATALOG_TAG, LIVE_TAG, productTag, sellerTag } from "../cache-tags";
import { services } from "../container";
import { currentAdmin, isAdminEmail } from "../session";

type Failure = { ok: false; code: string; message: string };
type Done = { ok: true } | Failure;
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const forbidden = () => fail("forbidden", "Only admins can do that.");
const unreadable = () => fail("invalid", "That couldn't be read.");
const id = z.uuid();
const sellerId = z.string().min(1).max(60);
const reason = z.string().trim().min(5, "Say why in a sentence.").max(500);

/** The signed-in admin and the app, or null. */
async function admin() {
  const a = await currentAdmin();
  return a ? { admin: a, app: await services() } : null;
}

async function audit(app: Awaited<ReturnType<typeof services>>, adminId: string, action: AdminAction, targetType: string, targetId: string, note?: string | null) {
  await recordAdmin(app.db, { adminId, action, targetType, targetId, note });
}

const done = (r: { ok: true } | { ok: false; error: { code: string; message: string } }): Done => (r.ok ? { ok: true } : fail(r.error.code, r.error.message));

// ---- Queues -------------------------------------------------------------------------

export async function approveApplicationAction(applicationId: string): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const parsed = id.safeParse(applicationId);
  if (!parsed.success) return fail("invalid", "No such application.");
  const r = await s.app.onboarding.approve(s.admin.id, parsed.data);
  if (!r.ok) return fail(r.error.code, r.error.message);
  await audit(s.app, s.admin.id, "application.approve", "application", parsed.data, r.value.sellerId);
  // The shop page exists from now on (a visit before approval may have cached "no such shop").
  if (r.value.sellerId) updateTag(sellerTag(r.value.sellerId));
  revalidateTag(CATALOG_TAG, "max");
  return { ok: true };
}

export async function rejectApplicationAction(applicationId: string, note: string): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const parsed = id.safeParse(applicationId);
  if (!parsed.success) return fail("invalid", "No such application.");
  const text = z.string().max(2000).catch("").parse(note);
  const r = await s.app.onboarding.reject(s.admin.id, parsed.data, text);
  if (r.ok) await audit(s.app, s.admin.id, "application.reject", "application", parsed.data, text);
  return done(r);
}

export async function approveVideoAction(videoId: string): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const parsed = z.string().min(1).max(64).safeParse(videoId);
  if (!parsed.success) return fail("invalid", "No such video.");
  const r = await s.app.moderation.approveVideo(parsed.data);
  if (r.ok) await audit(s.app, s.admin.id, "video.approve", "video", parsed.data);
  return done(r);
}

/** Take something down (or keep it and close its reports). Videos waiting for review can be rejected this way too. */
export async function resolveAction(targetType: string, targetId: string, action: "remove" | "dismiss"): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const parsed = z
    .object({ targetType: z.enum(REPORT_TARGETS), targetId: z.string().min(1).max(64), action: z.enum(["remove", "dismiss"]) })
    .safeParse({ targetType, targetId, action });
  if (!parsed.success) return unreadable();
  const r = await s.app.moderation.resolve(s.admin.id, parsed.data.targetType, parsed.data.targetId, parsed.data.action);
  if (r.ok) await audit(s.app, s.admin.id, action === "remove" ? "content.remove" : "content.keep", parsed.data.targetType, parsed.data.targetId);
  return done(r);
}

/** Decide a dispute: refund the buyer, or release the money to the shop. Both sides see the note. */
export async function resolveDisputeAction(orderId: string, seller: string, outcome: "refund" | "release", note: string): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.object({ orderId: z.uuid(), sellerId, outcome: z.enum(["refund", "release"]), note: z.string().max(2000) }).safeParse({ orderId, sellerId: seller, outcome, note });
  if (!p.success) return unreadable();
  const r = await s.app.fulfilment.resolve(s.admin.id, p.data.orderId, p.data.sellerId, p.data.outcome, p.data.note);
  if (r.ok) await audit(s.app, s.admin.id, "dispute.resolve", "parcel", `${p.data.orderId}:${p.data.sellerId}`, `${p.data.outcome}: ${p.data.note}`);
  return done(r);
}

/** Record a payout or refund sent from the treasury wallet. */
export async function markSentAction(transferId: string, txHash: string, address: string | null): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.object({ id: z.uuid(), txHash: z.string().max(100), address: z.string().max(100).nullable() }).safeParse({ id: transferId, txHash, address });
  if (!p.success) return unreadable();
  const r = await s.app.escrow.markSent(s.admin.id, p.data.id, { txHash: p.data.txHash, address: p.data.address || null });
  if (r.ok) await audit(s.app, s.admin.id, "payout.sent", "transfer", p.data.id, p.data.txHash);
  return done(r);
}

export async function cancelPayoutAction(transferId: string, note: string): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.object({ id: z.uuid(), note: z.string().max(1000) }).safeParse({ id: transferId, note });
  if (!p.success) return unreadable();
  const r = await s.app.escrow.cancelPayout(s.admin.id, p.data.id, p.data.note);
  if (r.ok) await audit(s.app, s.admin.id, "payout.cancel", "transfer", p.data.id, p.data.note);
  return done(r);
}

// ---- People and shops ---------------------------------------------------------------

/** Suspends an account (it's signed out everywhere and can't sign back in), or lifts it. */
export async function suspendAccountAction(accountId: string, why: string | null): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.object({ accountId: id, why: reason.nullable() }).safeParse({ accountId, why });
  if (!p.success) return fail("invalid", p.error.issues[0]?.message ?? "That couldn't be read.");
  if (p.data.why !== null) {
    if (p.data.accountId === s.admin.id) return fail("not_allowed", "You can't suspend yourself.");
    if (isAdminEmail(await accountEmail(s.app.db, p.data.accountId))) return fail("not_allowed", "Admins can't be suspended here; remove them from ADMIN_EMAILS first.");
  }
  const r = await s.app.identity.setSuspended(p.data.accountId, p.data.why);
  if (r.ok) await audit(s.app, s.admin.id, p.data.why === null ? "account.restore" : "account.suspend", "account", p.data.accountId, p.data.why);
  return done(r);
}

/**
 * Suspends a shop: its page and listings go dark, its tools lock, a live show ends and
 * ads stop. Or lifts it, putting its listings back up (ads stay paused for the shop to restart).
 */
export async function suspendShopAction(shop: string, why: string | null): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.object({ shop: sellerId, why: reason.nullable() }).safeParse({ shop, why });
  if (!p.success) return fail("invalid", p.error.issues[0]?.message ?? "That couldn't be read.");
  const { app } = s;
  if (p.data.why === null) {
    const r = await app.catalogAdmin.restoreShop(p.data.shop);
    if (!r.ok) return fail(r.error.code, r.error.message);
  } else {
    const r = await app.catalogAdmin.suspendShop(p.data.shop, p.data.why, new Date());
    if (!r.ok) return fail(r.error.code, r.error.message);
    const [shows, ads] = await Promise.all([app.live.forSeller(p.data.shop), app.ads.list(p.data.shop)]);
    await Promise.all([
      ...shows.filter((x) => x.status === "live").map((x) => app.live.end(p.data.shop, x.id)),
      ...ads.filter((c) => c.status === "active").map((c) => app.ads.update(p.data.shop, c.id, { status: "paused" })),
    ]);
    updateTag(LIVE_TAG);
  }
  await audit(app, s.admin.id, p.data.why === null ? "shop.restore" : "shop.suspend", "shop", p.data.shop, p.data.why);
  updateTag(sellerTag(p.data.shop));
  updateTag(CATALOG_TAG);
  return { ok: true };
}

export async function verifyShopAction(shop: string, verified: boolean): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.object({ shop: sellerId, verified: z.boolean() }).safeParse({ shop, verified });
  if (!p.success) return unreadable();
  const r = await s.app.catalogAdmin.setVerified(p.data.shop, p.data.verified);
  if (!r.ok) return fail(r.error.code, r.error.message);
  await audit(s.app, s.admin.id, p.data.verified ? "shop.verify" : "shop.unverify", "shop", p.data.shop);
  updateTag(sellerTag(p.data.shop));
  revalidateTag(CATALOG_TAG, "max");
  return { ok: true };
}

// ---- Listings, orders, content, ads -------------------------------------------------

/** Takes a listing down with a note the seller sees, or puts it back up (why = null). */
export async function removeListingAction(productId: string, why: string | null): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.object({ productId: id, why: reason.nullable() }).safeParse({ productId, why });
  if (!p.success) return fail("invalid", p.error.issues[0]?.message ?? "That couldn't be read.");
  const r = p.data.why === null ? await s.app.catalogAdmin.restoreListing(p.data.productId) : await s.app.catalogAdmin.removeListing(p.data.productId, p.data.why);
  if (!r.ok) return fail(r.error.code, r.error.message);
  await audit(s.app, s.admin.id, p.data.why === null ? "listing.restore" : "listing.remove", "listing", r.value.slug, p.data.why);
  updateTag(productTag(r.value.slug));
  updateTag(sellerTag(r.value.sellerId));
  updateTag(CATALOG_TAG);
  return { ok: true };
}

/** Refunds a parcel that isn't settled yet, no dispute needed. Both sides see the note. */
export async function refundParcelAction(orderId: string, shop: string, note: string): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.object({ orderId: id, shop: sellerId, note: z.string().max(1000) }).safeParse({ orderId, shop, note });
  if (!p.success) return unreadable();
  const r = await s.app.fulfilment.refund(s.admin.id, p.data.orderId, p.data.shop, p.data.note);
  if (r.ok) await audit(s.app, s.admin.id, "parcel.refund", "parcel", `${p.data.orderId}:${p.data.shop}`, p.data.note);
  return done(r);
}

export async function endShowAction(showId: string): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.string().min(1).max(64).safeParse(showId);
  if (!p.success) return fail("invalid", "No such show.");
  const found = await s.app.live.show(p.data);
  if (!found) return fail("not_found", "No such show.");
  const r = await s.app.live.end(found.show.sellerId, p.data);
  if (!r.ok) return fail(r.error.code, r.error.message);
  await audit(s.app, s.admin.id, "show.end", "show", p.data);
  updateTag(LIVE_TAG);
  return { ok: true };
}

export async function pauseCampaignAction(campaignId: string): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = id.safeParse(campaignId);
  if (!p.success) return fail("invalid", "No such campaign.");
  const shop = await campaignSeller(s.app.db, p.data);
  if (!shop) return fail("not_found", "No such campaign.");
  const r = await s.app.ads.update(shop, p.data, { status: "paused" });
  if (r.ok) await audit(s.app, s.admin.id, "campaign.pause", "campaign", p.data);
  return done(r);
}

// ---- Coupons ------------------------------------------------------------------------

const couponInput = z.object({
  kind: z.enum(["amount", "percent", "free_shipping"]),
  value: z.number().finite(),
  minSpend: z.number().finite(),
  title: z.string().max(60),
  detail: z.string().max(200),
  days: z.number().int(),
});

/** Issues a platform coupon anyone can claim. Money in dollars; percent as a fraction. */
export async function issueCouponAction(input: z.input<typeof couponInput>): Promise<{ ok: true; id: string } | Failure> {
  const s = await admin();
  if (!s) return forbidden();
  const p = couponInput.safeParse(input);
  if (!p.success) return unreadable();
  const r = await s.app.coupons.issue(null, p.data);
  if (!r.ok) return fail(r.error.code, r.error.message);
  await audit(s.app, s.admin.id, "coupon.issue", "coupon", r.value.id, r.value.title);
  return { ok: true, id: r.value.id };
}

/** Ends any coupon now; claims in wallets stop working. */
export async function endCouponAction(couponId: string): Promise<Done> {
  const s = await admin();
  if (!s) return forbidden();
  const p = z.string().min(1).max(60).safeParse(couponId);
  if (!p.success) return fail("invalid", "No such coupon.");
  const r = await s.app.coupons.end(p.data, null);
  if (r.ok) await audit(s.app, s.admin.id, "coupon.end", "coupon", p.data);
  return done(r);
}
