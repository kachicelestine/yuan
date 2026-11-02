import "server-only";
import { headers } from "next/headers";
import { serverEnv } from "@/config/server-env";
import { clientIpFrom } from "./client-ip";
import { services } from "./container";

/** [requests, window in seconds] per subject: generous for people, tight for scripts. */
export const LIMITS = {
  /** Sign-in codes requested, per IP (each email is also capped by the identity module). */
  "auth.code": [10, 15 * 60],
  /** Code guesses, per IP (each code also allows only 5 tries). */
  "auth.verify": [30, 15 * 60],
  "auth.wallet": [30, 15 * 60],
  /** Trips to Google and back, per IP. */
  "auth.google": [30, 15 * 60],
  /** Orders placed, per account. */
  checkout: [20, 10 * 60],
  /** Coupon claims, check-ins, redemptions and bag syncs, per account. */
  "account.write": [120, 60],
  /** Searches, per IP. */
  search: [120, 60],
  /** Likes, votes and shares, per account (or IP for shares). */
  "content.react": [300, 60],
  /** Comments and questions, per account. */
  "content.post": [20, 10 * 60],
  /** Upload tickets and posts, per account. */
  "content.upload": [20, 60 * 60],
  /** Live chat messages, per account. */
  "live.chat": [20, 60],
  /** Hearts, per IP. */
  "live.heart": [120, 60],
  /** Bids and price holds, per account. */
  "live.bid": [60, 60],
  /** Feed pages, per IP. */
  feed: [240, 60],
  /** Watch beacons, per IP. */
  events: [120, 60],
  /** Creator link clicks, per IP. */
  ref: [30, 60],
  /** Questions to the Ask assistant, per account (each one costs model tokens). */
  ask: [30, 60 * 60],
  /** Photo searches, per account (or IP when signed out). */
  snap: [20, 60 * 60],
  /** Texts translated, per account (or IP when signed out). */
  translate: [60, 60 * 60],
  /** Shop ads clicks, per IP. */
  "ads.click": [120, 60],
} as const satisfies Record<string, readonly [number, number]>;

export type LimitName = keyof typeof LIMITS;

export async function clientIp() {
  return clientIpFrom(await headers(), serverEnv.TRUST_PROXY);
}

/** Counts one use of `name` by `subject`; false once the window's allowance is spent. */
export async function allow(name: LimitName, subject: string): Promise<boolean> {
  const [limit, windowSeconds] = LIMITS[name];
  const r = await (await services()).rateLimiter.hit(`${name}:${subject}`, limit, windowSeconds);
  return r.allowed;
}

export const RATE_LIMITED = { ok: false, code: "rate_limited", message: "That's a lot of tries in a short time. Wait a few minutes, then try again." } as const;
