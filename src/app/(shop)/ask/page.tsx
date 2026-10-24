import type { Metadata } from "next";
import { Suspense } from "react";
import { AskScreen } from "@/components/ask/ask-screen";

export const metadata: Metadata = { title: "Ask" };

// A question can arrive in the URL (?q=), so the chat reads it inside Suspense.
export default function AskPage() {
  return (
    <Suspense fallback={<div className="pt-safe mx-auto h-dvh max-w-[760px]" />}>
      <AskScreen />
    </Suspense>
  );
}

