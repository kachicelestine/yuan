import { and, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import type { DomainEvent, EventLog } from "@/shared/kernel";
import { newId } from "@/shared/kernel";
import type { Database } from "./database";
import { outbox } from "./platform-schema";

/** Dates become ISO strings; everything else in an event is already plain data. */
const toPayload = (event: DomainEvent) => JSON.parse(JSON.stringify(event)) as Record<string, unknown>;

/** Writes events to the outbox. Give it the transaction the change is being saved in. */
export class OutboxEventLog implements EventLog {
  constructor(
    private readonly db: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(aggregateId: string, event: DomainEvent) {
    const at = this.now();
    await this.db.insert(outbox).values({ id: newId(), topic: event.type, key: aggregateId, payload: toPayload(event), createdAt: at, availableAt: at });
  }
}

export type OutboxMessage = { id: string; topic: string; key: string; payload: Record<string, unknown>; attempts: number; createdAt: Date };
export type OutboxHandler = (message: OutboxMessage) => Promise<void>;

export type DispatchResult = { claimed: number; delivered: number; retried: number; failed: number };

/**
 * Delivers outbox rows to handlers, at least once. Rows are claimed with a lease
 * (FOR UPDATE SKIP LOCKED), so several dispatchers can run side by side without
 * taking the same row; a crashed dispatcher's lease just expires. Failures retry
 * with exponential backoff and stop after `maxAttempts`.
 *
 * A dispatcher only claims topics it has a handler for. During a deploy (or with a
 * stale dev server on the same database) an older version must not swallow events
 * it doesn't understand: they wait for a version that does. Topics nothing handles
 * are retired after a while by `retireUnhandled`.
 */
export class OutboxDispatcher {
  constructor(
    private readonly db: Database,
    private readonly handlers: Readonly<Record<string, OutboxHandler | undefined>>,
    private readonly options: { batch?: number; leaseMs?: number; maxAttempts?: number; now?: () => Date } = {},
  ) {}

  private get topics() {
    return Object.keys(this.handlers).filter((t) => this.handlers[t]);
  }

  private get now() {
    return this.options.now?.() ?? new Date();
  }

  /** Backoff after the nth failed attempt: 5 s, 10 s, 20 s … capped at an hour. */
  static backoffMs(attempts: number) {
    return Math.min(3_600_000, 5_000 * 2 ** Math.max(0, attempts - 1));
  }

  async dispatchOnce(): Promise<DispatchResult> {
    const now = this.now;
    const leaseUntil = new Date(now.getTime() + (this.options.leaseMs ?? 60_000));
    const batch = this.options.batch ?? 25;
    const topics = this.topics;
    if (!topics.length) return { claimed: 0, delivered: 0, retried: 0, failed: 0 };
    const claimed = await this.db
      .update(outbox)
      .set({ lockedUntil: leaseUntil, attempts: sql`${outbox.attempts} + 1` })
      .where(
        sql`${outbox.id} in (
          select id from ${outbox}
          where ${outbox.processedAt} is null and ${outbox.failedAt} is null and ${outbox.availableAt} <= ${now.toISOString()}
            and ${inArray(outbox.topic, topics)}
            and (${outbox.lockedUntil} is null or ${outbox.lockedUntil} < ${now.toISOString()})
          order by ${outbox.availableAt}
          limit ${batch}
          for update skip locked
        )`,
      )
      .returning();

    const result: DispatchResult = { claimed: claimed.length, delivered: 0, retried: 0, failed: 0 };
    for (const row of claimed) {
      const message: OutboxMessage = { id: row.id, topic: row.topic, key: row.key, payload: row.payload as Record<string, unknown>, attempts: row.attempts, createdAt: row.createdAt };
      try {
        await this.handlers[row.topic]!(message);
        await this.db.update(outbox).set({ processedAt: this.now, lockedUntil: null, lastError: null }).where(eq(outbox.id, row.id));
        result.delivered++;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (row.attempts >= (this.options.maxAttempts ?? 10)) {
          await this.db.update(outbox).set({ failedAt: this.now, lockedUntil: null, lastError: reason }).where(eq(outbox.id, row.id));
          result.failed++;
        } else {
          const retryAt = new Date(this.now.getTime() + OutboxDispatcher.backoffMs(row.attempts));
          await this.db.update(outbox).set({ availableAt: retryAt, lockedUntil: null, lastError: reason }).where(eq(outbox.id, row.id));
          result.retried++;
        }
      }
    }
    return result;
  }

  /**
   * Marks waiting rows older than `before` whose topic no handler here knows as delivered
   * (nothing subscribes to them: OrderPlaced kept for history, say). Run it only from the
   * newest version, so a topic a newer version handles is never retired by an older one.
   */
  async retireUnhandled(before: Date) {
    const topics = this.topics;
    const rows = await this.db
      .update(outbox)
      .set({ processedAt: this.now, lastError: "no subscriber" })
      .where(and(isNull(outbox.processedAt), isNull(outbox.failedAt), lt(outbox.createdAt, before), topics.length ? notInArray(outbox.topic, topics) : undefined))
      .returning({ id: outbox.id });
    return rows.length;
  }

  /** Deletes delivered rows older than `before`. Failed rows stay until a person clears them. */
  async prune(before: Date) {
    const removed = await this.db
      .delete(outbox)
      .where(and(lt(outbox.processedAt, before), isNull(outbox.failedAt)))
      .returning({ id: outbox.id });
    return removed.length;
  }

  /** Rows waiting or failed, for the health check and admin views. */
  async backlog() {
    const now = this.now;
    const [row] = await this.db
      .select({
        pending: sql<number>`count(*) filter (where ${outbox.processedAt} is null and ${outbox.failedAt} is null)::int`,
        due: sql<number>`count(*) filter (where ${outbox.processedAt} is null and ${outbox.failedAt} is null and ${outbox.availableAt} <= ${now.toISOString()})::int`,
        failed: sql<number>`count(*) filter (where ${outbox.failedAt} is not null)::int`,
      })
      .from(outbox);
    return row ?? { pending: 0, due: 0, failed: 0 };
  }
}
