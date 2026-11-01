import "server-only";
import { log } from "@/shared/infrastructure/log";
import { buildJobs } from "./jobs";

const jobLog = log.child({ scope: "jobs" });
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

type JobStatus = { startedAt: Date | null; lastDispatchAt: Date | null; lastTickAt: Date | null; lastEncodeAt: Date | null };

// On globalThis because instrumentation and route handlers are bundled apart: a module-level
// object would give the health check its own copy that never changes.
const globalForStatus = globalThis as typeof globalThis & { __lycheeJobStatus?: JobStatus };

/** Last successful loop pass, for the health check. */
export const jobStatus = (globalForStatus.__lycheeJobStatus ??= { startedAt: null, lastDispatchAt: null, lastTickAt: null, lastEncodeAt: null });

/**
 * One pass of everything, for hosts with no long-running process (a serverless function
 * called on a schedule): recurring jobs that are due, one video to encode, then events until
 * none are left or `budgetMs` runs out. Leases make overlapping calls safe.
 */
export async function runJobsOnce(budgetMs: number) {
  const { app, dispatcher, scheduler } = await buildJobs();
  const deadline = Date.now() + budgetMs;
  const ran = await scheduler.tick();
  jobStatus.lastTickAt = new Date();
  for (const run of ran) if (!run.ok) jobLog.error("job failed", run);
  const encoded = await app.uploads.encodeNext();
  if (encoded) jobLog.info("video encoded", encoded);
  jobStatus.lastEncodeAt = new Date();
  let delivered = 0;
  while (Date.now() < deadline) {
    const r = await dispatcher.dispatchOnce();
    jobStatus.lastDispatchAt = new Date();
    delivered += r.delivered;
    if (r.retried || r.failed) jobLog.warn("outbox delivery problems", r);
    if (r.claimed === 0 || r.claimed !== r.delivered) break;
  }
  return { jobs: ran, delivered };
}

/**
 * Three loops until `signal` aborts: deliver outbox events (every second, straight away
 * again while there's a backlog), tick recurring jobs (every 10 s) and encode uploaded
 * videos one at a time (encoding can take minutes, so it never holds up the others).
 * Errors are logged and retried; they never stop the loops.
 */
export async function runJobs(signal: AbortSignal) {
  const { app, dispatcher, scheduler } = await buildJobs();
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

  const encodeLoop = async () => {
    while (!signal.aborted) {
      try {
        const done = await app.uploads.encodeNext();
        jobStatus.lastEncodeAt = new Date();
        if (done) {
          jobLog.info("video encoded", done);
          continue; // the queue may hold more
        }
      } catch (error) {
        jobLog.error("video encoding failed", { error });
      }
      await sleep(5_000, signal);
    }
  };

  await Promise.all([dispatchLoop(), scheduleLoop(), encodeLoop()]);
  jobLog.info("background jobs stopped");
}
