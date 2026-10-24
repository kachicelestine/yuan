"use server";

import { z } from "zod";
import { MAX_LIST } from "@/modules/engagement";
import { MAX_CART_LINES } from "@/modules/ordering";
import { accountData, type AccountState } from "../account-data";
import { services } from "../container";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const signedOut = () => fail("signed_out", "Sign in to keep this on your account.");

const slug = z.string().min(1).max(120);
// Bounds are generous (the domain trims further); they only stop oversized payloads.
const deviceData = z.object({
  cart: z
    .array(z.object({ slug, option: z.string().max(200).nullable(), qty: z.number().int().min(1).max(999), note: z.string().max(200).nullable() }))
    .max(MAX_CART_LINES * 4),
  saved: z.array(slug).max(MAX_LIST * 2),
  alerts: z.array(slug).max(MAX_LIST * 2),
  watches: z.array(z.object({ slug, target: z.number().positive().max(10_000_000), autoBuy: z.boolean() })).max(MAX_LIST * 2),
});
const couponIds = z.array(z.string().min(1).max(64)).max(100);

/**
 * Keeps the device and the account in step. `merge` runs once when a device first sees
 * an account (the device's bag and lists join the account's); `save` stores later edits.
 */
export async function syncAccountAction(
  input: { mode: "merge"; data: z.input<typeof deviceData> & { coupons: string[] } } | { mode: "save"; data: z.input<typeof deviceData> },
): Promise<{ ok: true; state: AccountState | null } | Failure> {
  const account = await currentAccount();
  if (!account) return signedOut();
  const data = deviceData.safeParse(input?.data);
  if (!data.success) return fail("invalid", "That data couldn't be read.");
  const store = accountData(await services());
  if (input.mode === "merge") {
    const coupons = couponIds.safeParse((input.data as { coupons?: unknown }).coupons ?? []);
    return { ok: true, state: await store.merge(account.id, { ...data.data, coupons: coupons.success ? coupons.data : [] }) };
  }
  await store.save(account.id, data.data);
  return { ok: true, state: null };
}

/** Puts a free coupon in the wallet. */
export async function claimCouponAction(couponId: string): Promise<{ ok: true; coupons: string[] } | Failure> {
  const account = await currentAccount();
  if (!account) return signedOut();
  const id = z.string().min(1).max(64).safeParse(couponId);
  if (!id.success) return fail("unknown_coupon", "That coupon doesn't exist.");
  return { ok: true, coupons: await (await services()).engagement.claimCoupons(account.id, [id.data]) };
}

/** Today's check-in; checking in again the same day pays nothing. */
export async function checkInAction(): Promise<{ ok: true; coins: number; checkin: AccountState["checkin"]; earned: number } | Failure> {
  const account = await currentAccount();
  if (!account) return signedOut();
  return { ok: true, ...(await (await services()).engagement.checkIn(account.id)) };
}

/** Spends coins on a coupon from the reward store. */
export async function redeemRewardAction(rewardId: string): Promise<{ ok: true; coins: number; coupons: string[] } | Failure> {
  const account = await currentAccount();
  if (!account) return signedOut();
  const id = z.string().min(1).max(64).safeParse(rewardId);
  if (!id.success) return fail("unknown_reward", "That reward isn't available.");
  const r = await (await services()).engagement.redeem(account.id, id.data);
  return r.ok ? { ok: true, ...r.value } : fail(r.error.code, r.error.message);
}
