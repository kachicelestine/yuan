import { isInternalRequest } from "@/server/internal";
import { runJobsOnce } from "@/server/jobs/runner";

/** Plans allow at least this long; a pass stops taking on work well before it. */
export const maxDuration = 60;

/**
 * GET /api/internal/jobs — one pass of the background work, for hosts with no long-running
 * process. Something calls it every minute or so (see deploy/VERCEL.md), authorised by
 * INTERNAL_TOKEN. Safe to overlap or repeat: jobs and events are claimed with leases.
 */
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return Response.json({ error: "not_found" }, { status: 404 });
  const { jobs, delivered } = await runJobsOnce(40_000);
  return Response.json({ jobs, delivered }, { headers: { "cache-control": "no-store" } });
}
