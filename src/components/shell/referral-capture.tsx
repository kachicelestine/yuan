"use client";

import { useEffect } from "react";

/** Tells the server about a creator link (?ref=…), then tidies the address bar. */
export async function sendReferral(code: string, path: string) {
  try {
    await fetch("/api/ref", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, path }), keepalive: true });
  } catch {
    // Offline or blocked: the link just doesn't count.
  }
}

/**
 * Picks up a creator code from any page's address (`?ref=k7m2qx9`). Reads the URL in an
 * effect rather than from search params, so static pages stay static.
 */
export function ReferralCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("ref");
    if (!code || !/^[a-z2-9]{7}$/.test(code)) return;
    void sendReferral(code, url.pathname);
    url.searchParams.delete("ref");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
