"use client";

import { useEffect, useRef } from "react";

// Tells the server how long each video was watched, so the feed can rank on it and shops
// see their views. Time is measured while the slide is on screen and the tab is visible,
// and sent in small batches with sendBeacon (it survives the page closing).

/** A view counts once someone stays this long. */
const VIEW_AFTER_MS = 2_000;
const BATCH = 6;

type Watch = { v: string; ms: number; view: boolean; done: boolean };

export function useWatchBeacons(activeId: string | undefined) {
  const queue = useRef<Watch[]>([]);
  const viewed = useRef(new Set<string>());
  const since = useRef<number | null>(null);
  const current = useRef<string | undefined>(undefined);

  useEffect(() => {
    const send = () => {
      if (!queue.current.length) return;
      const body = JSON.stringify({ watches: queue.current.splice(0) });
      if (!navigator.sendBeacon?.("/api/events", body)) void fetch("/api/events", { method: "POST", body, keepalive: true }).catch(() => {});
    };
    // Close the open stretch of watching for the current video.
    const close = () => {
      const id = current.current;
      if (!id || since.current === null) return;
      const ms = Math.round(performance.now() - since.current);
      since.current = null;
      if (ms < 250) return;
      const view = ms >= VIEW_AFTER_MS && !viewed.current.has(id);
      if (view) viewed.current.add(id);
      queue.current.push({ v: id, ms: Math.min(ms, 600_000), view, done: false });
      if (queue.current.length >= BATCH) send();
    };
    const open = () => {
      if (current.current && document.visibilityState === "visible") since.current = performance.now();
    };

    close();
    current.current = activeId;
    open();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        close();
        send();
      } else open();
    };
    const onHide = () => {
      close();
      send();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [activeId]);

  // Leaving the feed (client navigation) sends whatever is left.
  useEffect(
    () => () => {
      const id = current.current;
      const ms = since.current === null ? 0 : Math.round(performance.now() - since.current);
      since.current = null;
      if (id && ms >= 250) {
        const view = ms >= VIEW_AFTER_MS && !viewed.current.has(id);
        queue.current.push({ v: id, ms: Math.min(ms, 600_000), view, done: false });
      }
      if (queue.current.length) navigator.sendBeacon?.("/api/events", JSON.stringify({ watches: queue.current.splice(0) }));
    },
    [],
  );
}
