import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { googleEnabled, startGoogleSignIn } from "@/server/google-sign-in";
import { allow, clientIp } from "@/server/rate-limits";
import { safeNext } from "@/server/redirects";

/** GET /api/auth/google?next=/path — off to Google's sign-in, then back to `next`. */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next") ?? undefined);
  if (!googleEnabled()) redirect(`/signin?next=${encodeURIComponent(next)}`);
  if (!(await allow("auth.google", await clientIp()))) redirect(`/signin?next=${encodeURIComponent(next)}&error=rate_limited`);
  redirect(await startGoogleSignIn(next));
}
