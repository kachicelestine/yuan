import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { googleEnabled } from "@/server/google-sign-in";
import { safeNext } from "@/server/redirects";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 h-72 max-w-[400px] skeleton rounded-[28px]" />}>
      <SignInBody searchParams={searchParams} />
    </Suspense>
  );
}

/** Why a trip to Google came back without signing in (`?error=` from its callback). */
const GOOGLE_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't work. Try again, or use email.",
  google_cancelled: "You cancelled at Google. Nothing was shared.",
  google_email: "Google doesn't run that email address, so it can't vouch for it. Use the email code instead.",
  suspended: "This account is suspended. Write to support if you think that's a mistake.",
  rate_limited: "That's a lot of tries. Wait a few minutes, then try again.",
};

async function SignInBody({ searchParams }: Pick<PageProps<"/signin">, "searchParams">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  await connection();
  // Already signed in: carry on to where they were going.
  if (await currentAccount()) redirect(next);
  const error = typeof params.error === "string" ? (GOOGLE_ERRORS[params.error] ?? null) : null;
  return <SignInScreen next={next} google={googleEnabled()} initialError={error} />;
}
