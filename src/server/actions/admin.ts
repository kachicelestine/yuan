"use server";

import { revalidateTag, updateTag } from "next/cache";
import { z } from "zod";
import { REPORT_TARGETS } from "@/modules/content";
import { CATALOG_TAG, sellerTag } from "../cache-tags";
import { services } from "../container";
import { currentAdmin } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const forbidden = () => fail("forbidden", "Only admins can do that.");
const id = z.uuid();

export async function approveApplicationAction(applicationId: string): Promise<{ ok: true } | Failure> {
  const admin = await currentAdmin();
  if (!admin) return forbidden();
  const parsed = id.safeParse(applicationId);
  if (!parsed.success) return fail("invalid", "No such application.");
  const r = await (await services()).onboarding.approve(admin.id, parsed.data);
  if (!r.ok) return fail(r.error.code, r.error.message);
  // The shop page exists from now on (a visit before approval may have cached "no such shop").
  if (r.value.sellerId) updateTag(sellerTag(r.value.sellerId));
  revalidateTag(CATALOG_TAG, "max");
  return { ok: true };
}

export async function rejectApplicationAction(applicationId: string, note: string): Promise<{ ok: true } | Failure> {
  const admin = await currentAdmin();
  if (!admin) return forbidden();
  const parsed = id.safeParse(applicationId);
  if (!parsed.success) return fail("invalid", "No such application.");
  const r = await (await services()).onboarding.reject(admin.id, parsed.data, z.string().max(2000).catch("").parse(note));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

export async function approveVideoAction(videoId: string): Promise<{ ok: true } | Failure> {
  const admin = await currentAdmin();
  if (!admin) return forbidden();
  const parsed = z.string().min(1).max(64).safeParse(videoId);
  if (!parsed.success) return fail("invalid", "No such video.");
  const r = await (await services()).moderation.approveVideo(parsed.data);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** Take something down (or keep it and close its reports). Videos waiting for review can be rejected this way too. */
export async function resolveAction(targetType: string, targetId: string, action: "remove" | "dismiss"): Promise<{ ok: true } | Failure> {
  const admin = await currentAdmin();
  if (!admin) return forbidden();
  const parsed = z
    .object({ targetType: z.enum(REPORT_TARGETS), targetId: z.string().min(1).max(64), action: z.enum(["remove", "dismiss"]) })
    .safeParse({ targetType, targetId, action });
  if (!parsed.success) return fail("invalid", "That couldn't be read.");
  const r = await (await services()).moderation.resolve(admin.id, parsed.data.targetType, parsed.data.targetId, parsed.data.action);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** Decide a dispute: refund the buyer, or release the money to the shop. Both sides see the note. */
export async function resolveDisputeAction(orderId: string, sellerId: string, outcome: "refund" | "release", note: string): Promise<{ ok: true } | Failure> {
  const admin = await currentAdmin();
  if (!admin) return forbidden();
  const p = z.object({ orderId: z.uuid(), sellerId: z.string().min(1).max(60), outcome: z.enum(["refund", "release"]), note: z.string().max(2000) }).safeParse({ orderId, sellerId, outcome, note });
  if (!p.success) return fail("invalid", "That couldn't be read.");
  const r = await (await services()).fulfilment.resolve(admin.id, p.data.orderId, p.data.sellerId, p.data.outcome, p.data.note);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** Record a payout or refund sent from the treasury wallet. */
export async function markSentAction(id: string, txHash: string, address: string | null): Promise<{ ok: true } | Failure> {
  const admin = await currentAdmin();
  if (!admin) return forbidden();
  const p = z.object({ id: z.uuid(), txHash: z.string().max(100), address: z.string().max(100).nullable() }).safeParse({ id, txHash, address });
  if (!p.success) return fail("invalid", "That couldn't be read.");
  const r = await (await services()).escrow.markSent(admin.id, p.data.id, { txHash: p.data.txHash, address: p.data.address || null });
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

export async function cancelPayoutAction(id: string, note: string): Promise<{ ok: true } | Failure> {
  const admin = await currentAdmin();
  if (!admin) return forbidden();
  const p = z.object({ id: z.uuid(), note: z.string().max(1000) }).safeParse({ id, note });
  if (!p.success) return fail("invalid", "That couldn't be read.");
  const r = await (await services()).escrow.cancelPayout(admin.id, p.data.id, p.data.note);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}
