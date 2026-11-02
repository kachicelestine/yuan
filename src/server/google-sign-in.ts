import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { brand } from "@/config/brand";
import { serverEnv } from "@/config/server-env";

// "Continue with Google": OpenID Connect with the authorization code flow and PKCE. The
// browser goes to Google and comes back with a one-time code; the server swaps it for an ID
// token straight from Google and signs in by the email in it. A Google address (Gmail, or a
// Workspace domain) is one Google runs, so its word is as good as a code sent there; for any
// other address Google only checked it once, so those people use the email code instead.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-google-sign-in" : "google-sign-in";
const COOKIE_SECONDS = 10 * 60;

export const googleEnabled = () => !!(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET);

/** Where Google sends people back; registered on the OAuth client as an authorised redirect URI. */
export const googleRedirectUri = () => new URL("/api/auth/google/callback", brand.url).toString();

type Pending = { state: string; verifier: string; nonce: string; next: string };

const random = () => randomBytes(32).toString("base64url");

/** Remembers this attempt in a short-lived cookie and returns Google's sign-in page for it. */
export async function startGoogleSignIn(next: string): Promise<string> {
  const pending: Pending = { state: random(), verifier: random(), nonce: random(), next };
  (await cookies()).set(COOKIE, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, so the cookie comes along on Google's redirect back (a top-level GET).
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_SECONDS,
  });
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: serverEnv.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email",
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: createHash("sha256").update(pending.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/** The attempt this browser started, used up: a code can only come back once. */
export async function takePendingGoogleSignIn(): Promise<Pending | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete(COOKIE);
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, "base64url").toString()) as Partial<Pending>;
    return typeof p.state === "string" && typeof p.verifier === "string" && typeof p.nonce === "string" && typeof p.next === "string" ? (p as Pending) : null;
  } catch {
    return null;
  }
}

export type GoogleOutcome = { ok: true; email: string } | { ok: false; reason: "failed" | "not_google_email" };

/**
 * The email an ID token vouches for, after checking it was issued by Google, for us, for
 * this attempt and recently, and that Google runs the address.
 */
export function emailFromGoogleClaims(claims: Record<string, unknown>, expected: { clientId: string; nonce: string; now: Date }): GoogleOutcome {
  const { iss, aud, exp, nonce, email, email_verified, hd } = claims;
  if (typeof iss !== "string" || !ISSUERS.includes(iss)) return { ok: false, reason: "failed" };
  if (aud !== expected.clientId || nonce !== expected.nonce) return { ok: false, reason: "failed" };
  if (typeof exp !== "number" || exp * 1000 <= expected.now.getTime()) return { ok: false, reason: "failed" };
  if (typeof email !== "string" || email_verified !== true) return { ok: false, reason: "failed" };
  const address = email.trim().toLowerCase();
  const domain = address.split("@")[1] ?? "";
  const googleRuns = domain === "gmail.com" || domain === "googlemail.com" || (typeof hd === "string" && hd.toLowerCase() === domain);
  return googleRuns ? { ok: true, email: address } : { ok: false, reason: "not_google_email" };
}

/** Swaps the code Google sent back for the email it vouches for. */
export async function finishGoogleSignIn(code: string, pending: Pending, now: Date): Promise<GoogleOutcome> {
  let idToken: unknown;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: serverEnv.GOOGLE_CLIENT_ID!,
        client_secret: serverEnv.GOOGLE_CLIENT_SECRET!,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
        code_verifier: pending.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, reason: "failed" };
    idToken = ((await res.json()) as { id_token?: unknown }).id_token;
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (typeof idToken !== "string") return { ok: false, reason: "failed" };
  // The token came straight from Google's token endpoint over TLS, in exchange for our
  // client secret, so (OpenID Connect Core 3.1.3.7) its signature needn't be checked again.
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString());
  } catch {
    return { ok: false, reason: "failed" };
  }
  return emailFromGoogleClaims(claims, { clientId: serverEnv.GOOGLE_CLIENT_ID!, nonce: pending.nonce, now });
}
