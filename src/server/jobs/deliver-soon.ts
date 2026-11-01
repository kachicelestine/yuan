import "server-only";
import { after } from "next/server";
import { log } from "@/shared/infrastructure/log";

let queued = false;

/**
 * Without a background process, events would wait for the next scheduled pass, so an order's
 * emails and notifications could lag by minutes. This delivers them right after the response
 * that caused them. Scheduled passes still pick up anything missed.
 */
export function deliverEventsSoon() {
  if (queued) return;
  try {
    after(async () => {
      queued = false;
      try {
        const { buildJobs } = await import("./jobs");
        const { dispatcher } = await buildJobs();
        const deadline = Date.now() + 8_000;
        while (Date.now() < deadline) {
          const r = await dispatcher.dispatchOnce();
          if (r.claimed === 0 || r.claimed !== r.delivered) break;
        }
      } catch (error) {
        log.error("event delivery after a response failed", { error });
      }
    });
    queued = true;
  } catch {
    // Outside a request (a job, a script): the next scheduled pass delivers it.
  }
}
