import "server-only";
import { ATTRIBUTION_DAYS, isCode } from "@/modules/affiliates";

// The creator link a buyer last followed lives in a first-party cookie for the
// attribution window: "<code>.<unix ms>". Last click wins. The cookie only names a
// creator; what that earns is decided from the order at payment time.

export const REFERRAL_COOKIE = "ref";
export const REFERRAL_MAX_AGE = ATTRIBUTION_DAYS * 24 * 60 * 60;

export const referralValue = (code: string, at: Date) => `${code}.${at.getTime()}`;

/** The code in a referral cookie, if well formed and still inside the window. */
export function readReferral(value: string | undefined, now = new Date()): string | null {
  if (!value) return null;
  const [code, at] = value.split(".");
  const ms = Number(at);
  if (!code || !isCode(code) || !Number.isFinite(ms)) return null;
  const age = now.getTime() - ms;
  return age >= 0 && age <= REFERRAL_MAX_AGE * 1000 ? code : null;
}
