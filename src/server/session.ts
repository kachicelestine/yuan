import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { AccountView, SignedIn } from "@/modules/identity";
import { services } from "./container";

// The cookie only carries a random token; the database decides whether it's still valid
// (30 days, extended while in use). The cookie itself lasts the browser maximum so the
// database expiry, which can be revoked, is the one that counts.
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-session" : "session";
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/** The signed-in account for this request, or null. Read it inside a Suspense boundary. */
export const currentAccount = cache(async (): Promise<AccountView | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  const found = await (await services()).identity.currentAccount(token);
  return found?.account ?? null;
});

/** Sets the session cookie after sign-in. Only callable from server actions and route handlers. */
export async function startSession(signedIn: SignedIn) {
  (await cookies()).set(COOKIE, signedIn.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function endSession() {
  const jar = await cookies();
  await (await services()).identity.signOut(jar.get(COOKIE)?.value);
  jar.delete(COOKIE);
}
