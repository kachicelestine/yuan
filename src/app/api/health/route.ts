import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { serverEnv } from "@/config/server-env";
import { services } from "@/server/container";
import { jobStatus } from "@/server/jobs/runner";

const started = new Date();

/**
 * GET /api/health: 200 when the app can reach its database, 503 when it can't. Load
 * balancers and uptime checks poll it; the body says which build is running and how the
 * background jobs are doing.
 */
export async function GET() {
  await connection();
  const headers = { "cache-control": "no-store" };
  const t0 = performance.now();
  try {
    const app = await services();
    await app.db.execute(sql`select 1`);
    const dbMs = Math.round(performance.now() - t0);
    const outbox = await app.outbox.backlog();
    return Response.json(
      {
        status: "ok",
        deployment: process.env.NEXT_DEPLOYMENT_ID ?? null,
        uptimeSeconds: Math.round((Date.now() - started.getTime()) / 1000),
        database: { ok: true, ms: dbMs },
        jobs: { mode: serverEnv.JOBS, ...jobStatus },
        outbox,
      },
      { headers },
    );
  } catch (error) {
    return Response.json({ status: "unavailable", database: { ok: false, error: error instanceof Error ? error.message : String(error) } }, { status: 503, headers });
  }
}
