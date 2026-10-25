import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

// People vote on a friend's poll (or cut a friend's price) without an account. A random id
// in an http-only cookie stands in for them, so one browser counts once.

const COOKIE = "voter";
const MAX_AGE = 400 * 24 * 60 * 60;

/** The anonymous id for this browser, if it has one. */
export async function readVoter() {
  const v = (await cookies()).get(COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/.test(v) ? v : null;
}

/** The anonymous id for this browser, made on first use. Server actions and route handlers only. */
export async function voter() {
  const existing = await readVoter();
  if (existing) return existing;
  const id = randomUUID();
  (await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
  return id;
}
