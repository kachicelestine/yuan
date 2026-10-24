import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";
import type { Email } from "./account";

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
/** Codes one email may request per hour, so nobody can flood an inbox. */
export const CODES_PER_HOUR = 5;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
/** Sessions used after this age are extended, so active buyers stay signed in. */
export const SESSION_REFRESH_AFTER_MS = 24 * 60 * 60_000;

/** A one-time code sent by email. Only its hash is stored. */
export type EmailChallenge = Readonly<{
  id: string;
  email: Email;
  codeHash: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}>;

export type ChallengeError = DomainError<"code_expired" | "code_used" | "too_many_attempts" | "wrong_code">;

export function issueChallenge(props: { id: string; email: Email; codeHash: string; at: Date }): EmailChallenge {
  return { ...props, createdAt: props.at, expiresAt: new Date(props.at.getTime() + CODE_TTL_MS), attempts: 0, consumedAt: null };
}

/**
 * Checks a code the buyer typed. Every check counts as an attempt (so guessing is
 * capped), and a correct code is spent: it can't sign anyone in twice.
 */
export function attempt(c: EmailChallenge, codeHash: string, now: Date): { challenge: EmailChallenge; result: Result<Email, ChallengeError> } {
  if (c.consumedAt) return { challenge: c, result: err(domainError("code_used", "That code was already used. Ask for a new one.")) };
  if (now > c.expiresAt) return { challenge: c, result: err(domainError("code_expired", "That code expired. Ask for a new one.")) };
  if (c.attempts >= MAX_ATTEMPTS) return { challenge: c, result: err(domainError("too_many_attempts", "Too many tries. Ask for a new code.")) };
  const tried = { ...c, attempts: c.attempts + 1 };
  if (!timingSafeEqualHex(c.codeHash, codeHash)) {
    const left = MAX_ATTEMPTS - tried.attempts;
    return { challenge: tried, result: err(domainError("wrong_code", left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many tries. Ask for a new code.")) };
  }
  return { challenge: { ...tried, consumedAt: now }, result: ok(c.email) };
}

/** Compares two hex digests in constant time, so response timing reveals nothing. */
export function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** A signed-in device. The browser holds a random token; the database holds its hash. */
export type Session = Readonly<{ id: string; tokenHash: string; accountId: string; createdAt: Date; expiresAt: Date }>;

export function openSession(props: { id: string; tokenHash: string; accountId: string; at: Date }): Session {
  return { ...props, createdAt: props.at, expiresAt: new Date(props.at.getTime() + SESSION_TTL_MS) };
}

export const isLive = (s: Session, now: Date) => now < s.expiresAt;

/** The session with its expiry pushed out, or null when it doesn't need it yet. */
export function refreshed(s: Session, now: Date): Session | null {
  const age = SESSION_TTL_MS - (s.expiresAt.getTime() - now.getTime());
  return age >= SESSION_REFRESH_AFTER_MS ? { ...s, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) } : null;
}
