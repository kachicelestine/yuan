import { describe, expect, it } from "vitest";
import { parseEmail, accountLabel, type Email } from "./account";
import { attempt, issueChallenge, isLive, MAX_ATTEMPTS, openSession, refreshed, timingSafeEqualHex } from "./sign-in";
import { consumeWalletChallenge, issueWalletChallenge, signInMessage } from "./wallet";

const at = new Date("2026-10-24T10:00:00Z");
const later = (ms: number) => new Date(at.getTime() + ms);

describe("email", () => {
  it("normalises and rejects junk", () => {
    expect(parseEmail("  Ada@Example.COM ")).toEqual({ ok: true, value: "ada@example.com" });
    expect(parseEmail("not-an-email").ok).toBe(false);
    expect(parseEmail("a b@c.d").ok).toBe(false);
  });

  it("labels accounts by email, else a shortened wallet", () => {
    expect(accountLabel({ email: null, wallet: "0x1234567890abcdef1234567890abcdef12345678" })).toBe("0x1234…5678");
  });
});

describe("email challenge", () => {
  const c = issueChallenge({ id: "c1", email: "ada@example.com" as Email, codeHash: "aa11", at });

  it("signs in once with the right code", () => {
    const first = attempt(c, "aa11", later(1000));
    expect(first.result).toEqual({ ok: true, value: "ada@example.com" });
    expect(attempt(first.challenge, "aa11", later(2000)).result).toMatchObject({ ok: false, error: { code: "code_used" } });
  });

  it("counts wrong guesses and stops at the limit", () => {
    let current = c;
    for (let i = 0; i < MAX_ATTEMPTS; i++) current = attempt(current, "bb22", later(1000)).challenge;
    expect(attempt(current, "aa11", later(1000)).result).toMatchObject({ ok: false, error: { code: "too_many_attempts" } });
  });

  it("expires after ten minutes", () => {
    expect(attempt(c, "aa11", later(11 * 60_000)).result).toMatchObject({ ok: false, error: { code: "code_expired" } });
  });

  it("compares hashes in constant time", () => {
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
    expect(timingSafeEqualHex("abcd", "abc")).toBe(false);
  });
});

describe("session", () => {
  const s = openSession({ id: "s1", tokenHash: "h", accountId: "a1", at });

  it("lasts 30 days and is extended once it's a day old", () => {
    expect(isLive(s, later(29 * 86_400_000))).toBe(true);
    expect(isLive(s, later(31 * 86_400_000))).toBe(false);
    expect(refreshed(s, later(3_600_000))).toBeNull();
    expect(refreshed(s, later(2 * 86_400_000))?.expiresAt).toEqual(later(32 * 86_400_000));
  });
});

describe("wallet sign-in", () => {
  const p = { domain: "lychee.example", uri: "https://lychee.example", address: "0xAbC0000000000000000000000000000000000001", chainId: 8453, nonce: "abc123def456abc123def456", issuedAt: at, appName: "Lychee" };

  it("writes an EIP-4361 message that says what's being signed", () => {
    const m = signInMessage(p);
    expect(m.split("\n")[0]).toBe("lychee.example wants you to sign in with your Ethereum account:");
    expect(m).toContain("Nonce: abc123def456abc123def456");
    expect(m).toContain("doesn't move any funds");
    expect(m).toContain("Expiration Time: 2026-10-24T10:05:00.000Z");
  });

  it("accepts the right signer once, before expiry", () => {
    const c = issueWalletChallenge(p);
    const ok = consumeWalletChallenge(c, p.address.toLowerCase(), later(1000));
    expect(ok.ok).toBe(true);
    expect(ok.ok && consumeWalletChallenge(ok.value, p.address, later(2000)).ok).toBe(false);
    expect(consumeWalletChallenge(c, "0x0000000000000000000000000000000000000002", later(1000)).ok).toBe(false);
    expect(consumeWalletChallenge(c, p.address, later(6 * 60_000)).ok).toBe(false);
  });
});
