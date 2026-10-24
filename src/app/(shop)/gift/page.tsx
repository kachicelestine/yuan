import type { Metadata } from "next";
import { Suspense } from "react";
import { GiftUnwrap } from "@/components/gift/gift-unwrap";

export const metadata: Metadata = { title: "You've got a gift", description: "Unwrap it, pick your size and tell us where to send it." };

// Which gift to show comes from the link, so the screen renders on the client inside Suspense.
export default function GiftPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 size-[230px] skeleton rounded-[30px]" />}>
      <GiftUnwrap />
    </Suspense>
  );
}
