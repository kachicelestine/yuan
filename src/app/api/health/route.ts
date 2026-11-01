import { connection } from "next/server";
import { sql } from "drizzle-orm";

const started = new Date();

/**
 * GET /api/health: 200 when the app can reach its database, 503 when it can't. Load
 * balancers and uptime checks poll it; the body says which build is running and how the
 * background jobs are doing. Everything loads inside the try, so a bad setting comes back
 * as a readable 503 here rather than a blank 500.
 */
export async function GET() {
  await connection();
  const headers = { "cache-control": "no-store" };
  const t0 = performance.now();
  try {
    const [{ serverEnv }, { services }, { jobStatus }] = await Promise.all([import("@/config/server-env"), import("@/server/container"), import("@/server/jobs/runner")]);
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
        storage: serverEnv.STORAGE,
        outbox,
      },
      { headers },
    );
  } catch (error) {
    return Response.json({ status: "unavailable", database: { ok: false, error: error instanceof Error ? error.message : String(error) } }, { status: 503, headers });
  }
}
