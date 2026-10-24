import { and, eq, isNull, lt, lte, or } from "drizzle-orm";
import type { Database } from "./database";
import { schedules } from "./platform-schema";

export type ScheduledJob = { name: string; everyMs: number; run: () => Promise<void> };

/**
 * Runs recurring jobs exactly once per due time across any number of app instances:
 * a run starts only if a conditional UPDATE claims the row, and the next run time moves
 * forward when it finishes (or fails). A crashed run is retried once its lease expires.
 */
export class Scheduler {
  constructor(
    private readonly db: Database,
    private readonly jobs: readonly ScheduledJob[],
    private readonly options: { leaseMs?: number; now?: () => Date } = {},
  ) {}

  private get now() {
    return this.options.now?.() ?? new Date();
  }

  /** Runs every job that's due. Returns the names that ran (and whether each succeeded). */
  async tick(): Promise<{ name: string; ok: boolean; error?: string }[]> {
    const ran: { name: string; ok: boolean; error?: string }[] = [];
    for (const job of this.jobs) {
      const now = this.now;
      // A new job is due straight away.
      await this.db.insert(schedules).values({ name: job.name, nextRunAt: now }).onConflictDoNothing();
      const claimed = await this.db
        .update(schedules)
        .set({ lockedUntil: new Date(now.getTime() + (this.options.leaseMs ?? 10 * 60_000)) })
        .where(and(eq(schedules.name, job.name), lte(schedules.nextRunAt, now), or(isNull(schedules.lockedUntil), lt(schedules.lockedUntil, now))))
        .returning({ name: schedules.name });
      if (!claimed.length) continue;

      let error: string | undefined;
      try {
        await job.run();
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      const done = this.now;
      await this.db
        .update(schedules)
        .set({ lockedUntil: null, lastRunAt: done, lastError: error ?? null, nextRunAt: new Date(done.getTime() + job.everyMs) })
        .where(eq(schedules.name, job.name));
      ran.push({ name: job.name, ok: !error, error });
    }
    return ran;
  }
}
