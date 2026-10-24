// Runs background jobs in their own process: outbox delivery, invoice sweeps, rate refresh.
// Use it when the web servers run with JOBS=off (several app instances, or heavy jobs).
// Stops cleanly on SIGTERM so a deploy never cuts a job in half.
import { runJobs } from "@/server/jobs/runner";

const controller = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => controller.abort());
await runJobs(controller.signal);
process.exit(0);
