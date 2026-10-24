import "server-only";
import { serverEnv } from "@/config/server-env";
import { log } from "@/shared/infrastructure/log";
import { runJobs } from "./runner";

// One set of loops per process, kept on globalThis so dev hot reloads don't start more.
const globalForJobs = globalThis as typeof globalThis & { __lycheeJobs?: AbortController };

/**
 * Starts background jobs inside this server process when JOBS=inline (the default, right
 * for a single server). Builds never run them; a separate `pnpm worker` runs them when
 * JOBS=off. Stops on SIGTERM/SIGINT so a deploy drains cleanly.
 */
export function startInlineJobs() {
  if (serverEnv.JOBS !== "inline" || process.env.NEXT_PHASE === "phase-production-build" || globalForJobs.__lycheeJobs) return;
  const controller = new AbortController();
  globalForJobs.__lycheeJobs = controller;
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => controller.abort());
  // Give the server a moment to finish booting before the first database round trips.
  setTimeout(() => {
    runJobs(controller.signal).catch((error) => log.error("background jobs crashed", { scope: "jobs", error }));
  }, 2_000);
}
