"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { DISPUTE_REASONS } from "@/modules/ordering";
import { actorFor } from "../actor";
import { reviewsTag } from "../cache-tags";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const Parcel = z.object({ orderId: z.uuid(), sellerId: z.string().min(1).max(60) });

async function buyer() {
  const account = await currentAccount();
  if (!account) return { allowed: false as const, error: fail("signed_out", "Sign in to manage your order.") };
  if (!(await allow("account.write", account.id))) return { allowed: false as const, error: RATE_LIMITED as Failure };
  return { allowed: true as const, account, app: await services() };
}

/** The buyer got the parcel: the shop is paid. */
export async function confirmReceivedAction(orderId: string, sellerId: string): Promise<{ ok: true } | Failure> {
  const b = await buyer();
  if (!b.allowed) return b.error;
  const p = Parcel.safeParse({ orderId, sellerId });
  if (!p.success) return fail("invalid", "No such parcel.");
  const r = await b.app.fulfilment.confirm(b.account.id, p.data.orderId, p.data.sellerId);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** Something went wrong: the money stays held while a moderator looks. */
export async function openDisputeAction(orderId: string, sellerId: string, reason: string, note: string | null): Promise<{ ok: true } | Failure> {
  const b = await buyer();
  if (!b.allowed) return b.error;
  const p = Parcel.extend({ reason: z.enum(DISPUTE_REASONS), note: z.string().max(2000).nullable() }).safeParse({ orderId, sellerId, reason, note });
  if (!p.success) return fail("invalid", "Pick what went wrong.");
  const r = await b.app.fulfilment.dispute(b.account.id, p.data.orderId, p.data.sellerId, p.data.reason, p.data.note);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** A review of something delivered. */
export async function postReviewAction(orderId: string, productSlug: string, rating: number, text: string): Promise<{ ok: true } | Failure> {
  const b = await buyer();
  if (!b.allowed) return b.error;
  const p = z.object({ orderId: z.uuid(), productSlug: z.string().min(1).max(120), rating: z.number().int().min(1).max(5), text: z.string().max(4000) }).safeParse({ orderId, productSlug, rating, text });
  if (!p.success) return fail("invalid", "Pick a star rating and write a few words.");
  const r = await b.app.interactions.postReview(actorFor(b.account), p.data);
  if (!r.ok) return fail(r.error.code, r.error.message);
  updateTag(reviewsTag(p.data.productSlug));
  return { ok: true };
}

export async function markNotificationsReadAction(): Promise<{ ok: true } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("signed_out", "Sign in first.");
  await (await services()).notifications.markAllRead(account.id);
  return { ok: true };
}
