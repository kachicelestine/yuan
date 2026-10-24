import "server-only";
import { log } from "@/shared/infrastructure/log";
import { buildJobs } from "./jobs";

const jobLog = log.child({ scope: "jobs" });
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/** Last successful loop pass, for the health check. */
export const jobStatus = { startedAt: null as Date | null, lastDispatchAt: null as Date | null, lastTickAt: null as Date | null };

/**
 * Two loops until `signal` aborts: deliver outbox events (every second, straight away
 * again while there's a backlog) and tick recurring jobs (every 10 s). Errors are logged
 * and retried; they never stop the loops.
 */
export async function runJobs(signal: AbortSignal) {
  const { dispatcher, scheduler } = await buildJobs();
  jobStatus.startedAt = new Date();
  jobLog.info("background jobs started");

  const dispatchLoop = async () => {
    while (!signal.aborted) {
      try {
        const r = await dispatcher.dispatchOnce();
        jobStatus.lastDispatchAt = new Date();
        if (r.retried || r.failed) jobLog.warn("outbox delivery problems", r);
        if (r.claimed > 0 && r.claimed === r.delivered) continue; // more may be waiting
      } catch (error) {
        jobLog.error("outbox dispatch failed", { error });
      }
      await sleep(1_000, signal);
    }
  };

  const scheduleLoop = async () => {
    while (!signal.aborted) {
      try {
        for (const run of await scheduler.tick()) if (!run.ok) jobLog.error("job failed", run);
        jobStatus.lastTickAt = new Date();
      } catch (error) {
        jobLog.error("scheduler tick failed", { error });
      }
      await sleep(10_000, signal);
    }
  };

  await Promise.all([dispatchLoop(), scheduleLoop()]);
  jobLog.info("background jobs stopped");
}
