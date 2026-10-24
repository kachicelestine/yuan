"use client";

import { useOffline } from "next/offline";
import { useEffect } from "react";
import { Icon } from "@/components/icon";

/**
 * Installable-app plumbing: registers the offline service worker in production builds only
 * (so `next dev` never serves cached pages), and shows a banner while the connection is down.
 */
export function AppShellExtras() {
  const offline = useOffline();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Private mode or blocked: the app still works, just without the offline page.
    });
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-[95] flex justify-center px-4">
      <p className="mt-2 flex h-10 items-center gap-2 rounded-full bg-black/70 px-4 text-[13px] font-semibold ring-1 ring-white/15 backdrop-blur-xl motion-safe:animate-rise">
        <Icon name="globe" className="size-4 text-save" />
        You&apos;re offline. We&apos;ll retry as soon as you&apos;re back.
      </p>
    </div>
  );
}
