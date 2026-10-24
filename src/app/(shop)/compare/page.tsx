import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareScreen } from "@/components/compare/compare";

export const metadata: Metadata = { title: "Compare", description: "Up to three products side by side, priced to your door." };

// The list lives in the browser and the URL, so the screen renders on the client inside Suspense.
export default function ComparePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-dvh max-w-[1000px] px-3.5 pt-20 lg:px-6"><div className="skeleton h-40 rounded-[26px]" /></div>}>
      <CompareScreen />
    </Suspense>
  );
}
