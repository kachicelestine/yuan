import "server-only";
import type { LiveSignal } from "@/modules/live";
import { services } from "./container";

// Server-Sent Events for a live room: a snapshot on connect, then every update the bus
// carries (chat, pinned products, bids, the show starting or ending), a viewer count every
// few seconds, and a heartbeat comment so proxies keep the connection open.

const HEARTBEAT_MS = 15_000;
const VIEWERS_MS = 5_000;

export async function liveStream(showId: string, signal: AbortSignal): Promise<Response> {
  const app = await services();
  const room = await app.live.show(showId);
  if (!room) return new Response("No such show", { status: 404 });
  const bus = app.liveBus as typeof app.liveBus & { watching?: (id: string) => number };
  const encoder = new TextEncoder();

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (s: LiveSignal) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(s)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send({ type: "snapshot", ...room });
      const unsubscribe = bus.subscribe(showId, send);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);
      const countViewers = () => {
        const count = bus.watching?.(showId) ?? 0;
        send({ type: "viewers", count });
        void app.live.notePeak(showId, count).catch(() => {});
      };
      // Count right away (this viewer included), then every few seconds.
      countViewers();
      const viewers = setInterval(countViewers, VIEWERS_MS);
      cleanup = () => {
        cleanup = () => {};
        clearInterval(heartbeat);
        clearInterval(viewers);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
      signal.addEventListener("abort", () => cleanup(), { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Tell nginx-style proxies not to buffer the stream.
      "x-accel-buffering": "no",
    },
  });
}
