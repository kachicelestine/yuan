import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignInScreen } from "@/components/auth/sign-in-screen";
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

async function SignInBody({ searchParams }: Pick<PageProps<"/signin">, "searchParams">) {
  const next = safeNext((await searchParams).next);
  await connection();
  // Already signed in: carry on to where they were going.
  if (await currentAccount()) redirect(next);
  return <SignInScreen next={next} />;
}
