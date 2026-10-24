import type { Instrumentation } from "next";

/** Runs once when a server process starts: background jobs live here on single-server deployments. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startInlineJobs } = await import("./server/jobs/start");
  startInlineJobs();
}

/** Every server-side error, as one structured log line (the digest matches what the user sees). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("./shared/infrastructure/log");
  const e = error as { message?: string; digest?: string; stack?: string };
  log.error("request failed", {
    message: e?.message ?? String(error),
    digest: e?.digest,
    method: request.method,
    path: request.path,
    route: context.routePath,
    type: context.routeType,
    stack: e?.stack,
  });
};
