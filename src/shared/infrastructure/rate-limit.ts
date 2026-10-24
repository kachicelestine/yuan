import { lt, sql } from "drizzle-orm";
import type { Database } from "./database";
import { rateLimits } from "./platform-schema";

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

/**
 * Fixed-window rate limits kept in Postgres, so every app instance shares them and they
 * survive restarts. One upsert per check; fine for sign-in, checkout and search volumes.
 * (Hot paths at higher volume belong at the edge: Cloudflare rate-limiting rules.)
 */
export class PostgresRateLimiter {
  constructor(
    private readonly db: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const start = new Date(Math.floor(this.now().getTime() / windowMs) * windowMs);
    const [row] = await this.db
      .insert(rateLimits)
      .values({ key, windowStart: start, count: 1 })
      .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
      .returning({ count: rateLimits.count });
    const count = row?.count ?? 1;
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: new Date(start.getTime() + windowMs) };
  }

  /** Drops windows that ended before `before`. */
  async prune(before: Date) {
    const removed = await this.db.delete(rateLimits).where(lt(rateLimits.windowStart, before)).returning({ key: rateLimits.key });
    return removed.length;
  }
}
