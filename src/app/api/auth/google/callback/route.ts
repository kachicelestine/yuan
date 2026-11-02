import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { services } from "@/server/container";
import { finishGoogleSignIn, googleEnabled, takePendingGoogleSignIn } from "@/server/google-sign-in";
import { allow, clientIp } from "@/server/rate-limits";
import { safeNext } from "@/server/redirects";
import { startSession } from "@/server/session";

/** GET /api/auth/google/callback — Google sends people back here with a one-time code. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const pending = await takePendingGoogleSignIn();
  const next = safeNext(pending?.next);
  const back = (error: string) => `/signin?next=${encodeURIComponent(next)}&error=${error}`;
  if (!googleEnabled() || !pending) redirect(back("google"));
  // Cancelled at Google, or a reply to some other attempt (or someone else's).
  const code = params.get("code");
  if (!code || params.get("state") !== pending.state) redirect(back(params.get("error") === "access_denied" ? "google_cancelled" : "google"));
  if (!(await allow("auth.google", await clientIp()))) redirect(back("rate_limited"));

  const outcome = await finishGoogleSignIn(code, pending, new Date());
  if (!outcome.ok) redirect(back(outcome.reason === "not_google_email" ? "google_email" : "google"));
  const r = await (await services()).identity.signInWithVerifiedEmail(outcome.email);
  if (!r.ok) redirect(back(r.error.code === "suspended" ? "suspended" : "google"));
  await startSession(r.value);
  redirect(next);
}
