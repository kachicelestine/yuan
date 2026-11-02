import { describe, expect, it } from "vitest";
import { emailFromGoogleClaims } from "./google-sign-in";

// What Google's ID token must say before it signs anyone in.
describe("Google sign-in claims", () => {
  const now = new Date("2026-11-02T10:00:00Z");
  const expected = { clientId: "123.apps.googleusercontent.com", nonce: "n-1", now };
  const claims = { iss: "https://accounts.google.com", aud: expected.clientId, nonce: "n-1", exp: now.getTime() / 1000 + 300, email: "Ada@Gmail.com", email_verified: true };

  it("accepts a Gmail address Google has verified, lower-cased", () => {
    expect(emailFromGoogleClaims(claims, expected)).toEqual({ ok: true, email: "ada@gmail.com" });
  });

  it("accepts a Workspace address, whose domain Google runs", () => {
    expect(emailFromGoogleClaims({ ...claims, email: "ops@shop.example", hd: "shop.example" }, expected)).toEqual({ ok: true, email: "ops@shop.example" });
  });

  it("sends other addresses to the email code, even when Google once verified them", () => {
    expect(emailFromGoogleClaims({ ...claims, email: "ada@example.com" }, expected)).toEqual({ ok: false, reason: "not_google_email" });
    expect(emailFromGoogleClaims({ ...claims, email: "ada@example.com", hd: "other.example" }, expected)).toEqual({ ok: false, reason: "not_google_email" });
  });

  it("refuses tokens for another app or attempt, expired, unverified, or not from Google", () => {
    for (const bad of [
      { aud: "someone-else.apps.googleusercontent.com" },
      { nonce: "n-2" },
      { exp: now.getTime() / 1000 - 1 },
      { email_verified: false },
      { email_verified: "true" },
      { iss: "https://evil.example" },
      { email: undefined },
    ]) {
      expect(emailFromGoogleClaims({ ...claims, ...bad }, expected)).toEqual({ ok: false, reason: "failed" });
    }
  });
});
