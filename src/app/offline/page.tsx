import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Offline" };

// Precached by the service worker and shown when a page can't load without a connection.
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center pt-safe pb-safe">
      <EmptyState
        icon="globe"
        title="You're offline"
        body="Your bag, saved items and coupons are kept on this phone. We'll pick up where you left off as soon as you're back online."
        primary={{ href: "/", label: "Try again" }}
        secondary={{ href: "/checkout", label: "Open my bag" }}
        tint="from-series/50 to-positive/30"
      />
    </main>
  );
}
