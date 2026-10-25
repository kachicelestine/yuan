import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AskScreen } from "@/components/ask/ask-screen";
import { askEnabled } from "@/server/ask";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Ask" };

export default function AskPage() {
  return (
    <Suspense fallback={<div className="pt-safe mx-auto h-dvh max-w-[760px]" />}>
      <Body />
    </Suspense>
  );
}

// Whether Ask is on, and who's asking, are read per request; a question can also arrive in the URL (?q=).
async function Body() {
  await connection();
  return <AskScreen enabled={askEnabled()} signedIn={!!(await currentAccount())} />;
}
