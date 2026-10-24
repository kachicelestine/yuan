import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { openDatabase, type Database } from "./database";
import { OutboxDispatcher, OutboxEventLog } from "./outbox";
import { outbox, schedules } from "./platform-schema";
import { PostgresRateLimiter } from "./rate-limit";
import { Scheduler } from "./schedules";
import { unitOfWork } from "./unit-of-work";

let db: Database;
let clock = new Date("2026-10-24T10:00:00Z");
const now = () => clock;
const advance = (ms: number) => (clock = new Date(clock.getTime() + ms));

beforeAll(async () => {
  db = await openDatabase({ kind: "memory" });
});

describe("outbox", () => {
  it("records events only when the transaction commits", async () => {
    const uow = unitOfWork(db, (tx) => ({ events: new OutboxEventLog(tx, now) }));
    await uow.run(({ events }) => events.record("order-1", { type: "OrderPlaced", at: clock }));
    await expect(
      uow.run(async ({ events }) => {
        await events.record("order-2", { type: "OrderPlaced", at: clock });
        throw new Error("rolled back");
      }),
    ).rejects.toThrow("rolled back");
    const keys = (await db.select({ key: outbox.key }).from(outbox)).map((r) => r.key);
    expect(keys).toContain("order-1");
    expect(keys).not.toContain("order-2");
  });

  it("delivers handled topics once, leaves the rest for a version that handles them, then retires them", async () => {
    await new OutboxEventLog(db, now).record("order-3", { type: "Unhandled", at: clock });
    const seen: string[] = [];
    const dispatcher = new OutboxDispatcher(db, { OrderPlaced: async (m) => void seen.push(`${m.topic}:${m.key}`) }, { now });
    const first = await dispatcher.dispatchOnce();
    expect(first.delivered).toBe(1);
    expect(seen).toEqual(["OrderPlaced:order-1"]);
    expect((await dispatcher.dispatchOnce()).claimed).toBe(0);
    // An older dispatcher didn't swallow "Unhandled": a newer one still gets it.
    const newer = new OutboxDispatcher(db, { Unhandled: async (m) => void seen.push(`${m.topic}:${m.key}`) }, { now });
    expect((await newer.dispatchOnce()).delivered).toBe(1);
    expect(seen).toContain("Unhandled:order-3");

    // A topic nothing handles waits a week, then is retired.
    await new OutboxEventLog(db, now).record("order-9", { type: "History", at: clock });
    expect(await dispatcher.retireUnhandled(new Date(clock.getTime() - 7 * 24 * 3600_000))).toBe(0);
    advance(8 * 24 * 3600_000);
    expect(await dispatcher.retireUnhandled(new Date(clock.getTime() - 7 * 24 * 3600_000))).toBe(1);
    expect(await dispatcher.backlog()).toMatchObject({ pending: 0, failed: 0 });
  });

  it("retries failures with backoff, then gives up and keeps the row", async () => {
    await new OutboxEventLog(db, now).record("order-4", { type: "Flaky", at: clock });
    const handler = vi.fn().mockRejectedValue(new Error("mail server down"));
    const dispatcher = new OutboxDispatcher(db, { Flaky: handler }, { now, maxAttempts: 3 });

    expect((await dispatcher.dispatchOnce()).retried).toBe(1);
    // Not due again until the backoff passes.
    expect((await dispatcher.dispatchOnce()).claimed).toBe(0);
    advance(OutboxDispatcher.backoffMs(1));
    expect((await dispatcher.dispatchOnce()).retried).toBe(1);
    advance(OutboxDispatcher.backoffMs(2));
    expect((await dispatcher.dispatchOnce()).failed).toBe(1);

    const [row] = await db.select().from(outbox).where(eq(outbox.key, "order-4"));
    expect(row).toMatchObject({ attempts: 3, lastError: "mail server down" });
    expect(row.failedAt).not.toBeNull();
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("lets a crashed dispatcher's lease run out", async () => {
    await new OutboxEventLog(db, now).record("order-5", { type: "Slow", at: clock });
    const crashed = new OutboxDispatcher(db, { Slow: () => new Promise(() => {}) }, { now, leaseMs: 30_000 });
    void crashed.dispatchOnce(); // never finishes
    await new Promise((r) => setTimeout(r, 50));
    const other = new OutboxDispatcher(db, { Slow: async () => {} }, { now });
    expect((await other.dispatchOnce()).claimed).toBe(0);
    advance(31_000);
    expect((await other.dispatchOnce()).delivered).toBe(1);
  });

  it("prunes delivered rows but keeps failed ones", async () => {
    const dispatcher = new OutboxDispatcher(db, {}, { now });
    advance(15 * 24 * 3600_000);
    expect(await dispatcher.prune(new Date(clock.getTime() - 14 * 24 * 3600_000))).toBeGreaterThan(0);
    expect((await db.select().from(outbox)).every((r) => r.failedAt !== null)).toBe(true);
  });
});

describe("scheduler", () => {
  it("runs each job once per due time and records failures", async () => {
    const ran: string[] = [];
    const scheduler = new Scheduler(
      db,
      [
        { name: "every-minute", everyMs: 60_000, run: async () => void ran.push("minute") },
        { name: "broken", everyMs: 60_000, run: async () => Promise.reject(new Error("nope")) },
      ],
      { now },
    );
    const first = await scheduler.tick();
    expect(first).toEqual([
      { name: "every-minute", ok: true, error: undefined },
      { name: "broken", ok: false, error: "nope" },
    ]);
    expect(await scheduler.tick()).toEqual([]);
    advance(60_000);
    expect((await scheduler.tick()).map((r) => r.name)).toEqual(["every-minute", "broken"]);
    expect(ran).toEqual(["minute", "minute"]);
    const [broken] = await db.select().from(schedules).where(eq(schedules.name, "broken"));
    expect(broken.lastError).toBe("nope");
  });
});

describe("rate limits", () => {
  it("allows up to the limit per window, then resets", async () => {
    const limiter = new PostgresRateLimiter(db, now);
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await limiter.hit("auth.code:1.2.3.4", 3, 60)).allowed);
    expect(results).toEqual([true, true, true, false]);
    expect((await limiter.hit("auth.code:5.6.7.8", 3, 60)).allowed).toBe(true);
    advance(60_000);
    expect((await limiter.hit("auth.code:1.2.3.4", 3, 60)).allowed).toBe(true);
    advance(2 * 24 * 3600_000);
    expect(await limiter.prune(new Date(clock.getTime() - 24 * 3600_000))).toBeGreaterThan(0);
  });
});
