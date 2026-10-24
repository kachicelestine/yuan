import "server-only";
import { OutboxDispatcher, type OutboxHandler } from "@/shared/infrastructure/outbox";
import { Scheduler, type ScheduledJob } from "@/shared/infrastructure/schedules";
import { log } from "@/shared/infrastructure/log";
import { services, type Services } from "../container";
import { revalidateTags } from "../internal";
import { MARKETS_TAG } from "../cache-tags";

const jobLog = log.child({ scope: "jobs" });
const DAY = 24 * 60 * 60 * 1000;

/**
 * What happens when an event is delivered. Handlers must be idempotent: delivery is
 * at-least-once. Topics without a handler are marked delivered and kept for 14 days.
 */
function eventHandlers(app: Services): Record<string, OutboxHandler> {
  void app; // Notifications, search indexing and analytics subscribe here as they land.
  return {};
}

/** Recurring work. Each runs on one instance at a time, wherever the scheduler ticks. */
function recurringJobs(app: Services, dispatcher: OutboxDispatcher): ScheduledJob[] {
  return [
    {
      // Settles payments and closes lapsed invoices even when nobody has the pay page open.
      name: "invoices.sync",
      everyMs: 30_000,
      run: async () => {
        const r = await app.syncInvoices();
        if (r.paid || r.expired) jobLog.info("invoices synced", r);
      },
    },
    {
      name: "fx.refresh",
      everyMs: DAY,
      run: async () => {
        const r = await app.refreshRates();
        jobLog.info("exchange rates", r);
        if (r.updated) await revalidateTags([MARKETS_TAG]);
      },
    },
    { name: "outbox.prune", everyMs: DAY / 4, run: async () => void (await dispatcher.prune(new Date(Date.now() - 14 * DAY))) },
    { name: "rate-limits.prune", everyMs: DAY / 24, run: async () => void (await app.rateLimiter.prune(new Date(Date.now() - DAY))) },
  ];
}

export async function buildJobs() {
  const app = await services();
  const dispatcher = new OutboxDispatcher(app.db, eventHandlers(app));
  const scheduler = new Scheduler(app.db, recurringJobs(app, dispatcher));
  return { dispatcher, scheduler };
}
