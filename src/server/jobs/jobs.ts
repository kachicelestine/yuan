import "server-only";
import { OutboxDispatcher, type OutboxHandler } from "@/shared/infrastructure/outbox";
import { Scheduler, type ScheduledJob } from "@/shared/infrastructure/schedules";
import { log } from "@/shared/infrastructure/log";
import { services, type Services } from "../container";
import { revalidateTags } from "../internal";
import type { Message } from "@/modules/notifications";
import { cents } from "@/shared/kernel/money";
import { categoryVideosTag, commentsTag, FEED_TAG, MARKETS_TAG, productTag, questionsTag, reviewsTag, sellerReviewsTag, sellerVideosTag } from "../cache-tags";

const jobLog = log.child({ scope: "jobs" });
const DAY = 24 * 60 * 60 * 1000;

/**
 * What happens when an event is delivered. Handlers must be idempotent: delivery is
 * at-least-once. Topics without a handler wait (a newer version may handle them) and are
 * retired after a week.
 */
export function eventHandlers(app: Services): Record<string, OutboxHandler> {
  const usd = (amount: unknown) => `$${(Number(amount) / 100).toFixed(2)}`;
  /** Everyone running a shop. */
  const shopPeople = (sellerId: string) => app.onboarding.members(sellerId);
  const notify = (accountIds: string[], message: Message, key: string) => app.notifications.notify(accountIds, message, key);

  return {
    // A new video joins the feed, its shop and its category as soon as it's live.
    VideoPublished: async ({ id, payload }) => {
      const { sellerId, category, authorId, videoId } = payload as { sellerId: string; category: string; authorId: string | null; videoId: string };
      await revalidateTags([FEED_TAG, sellerVideosTag(sellerId), categoryVideosTag(category)]);
      if (authorId) await notify([authorId], { kind: "video_live", title: "Your video is live", body: "It's in the feed and on the shop's page now.", link: `/?v=${videoId}`, email: false }, id);
    },
    // A takedown disappears from every page that showed it.
    ContentRemoved: async ({ payload }) => {
      const p = payload as { targetType: string; videoId: string | null; productSlug: string | null; sellerId: string | null };
      const tags: string[] = [];
      if (p.videoId) tags.push(FEED_TAG, commentsTag(p.videoId));
      if (p.targetType === "video" && p.sellerId) tags.push(sellerVideosTag(p.sellerId));
      if (p.targetType === "question" && p.productSlug) tags.push(questionsTag(p.productSlug));
      if (p.targetType === "review" && p.productSlug) tags.push(reviewsTag(p.productSlug), ...(p.sellerId ? [sellerReviewsTag(p.sellerId)] : []));
      if (tags.length) await revalidateTags(tags);
    },

    // ── Orders and Protect ────────────────────────────────────────────────────
    OrderPaid: async ({ id, payload }) => {
      const { orderId } = payload as { orderId: string };
      const order = await app.getOrder.internal(orderId);
      if (!order) return;
      // Live prices and auction wins behind this order are used up.
      await app.live.useHolds(order.buyerId, [...new Set(order.lines.map((l) => l.slug))]);
      for (const parcel of await app.fulfilment.forOrder(orderId)) {
        await notify(await shopPeople(parcel.sellerId), { kind: "order_paid", title: `New order ${order.number}`, body: `${usd(parcel.amount * 100)} paid and held by Protect. Ship it to ${order.country} and add the tracking number.`, link: "/sell?tab=orders", email: true }, `${id}:${parcel.sellerId}`);
      }
    },
    ShipmentShipped: async ({ id, payload }) => {
      const { orderId, carrier, tracking } = payload as { orderId: string; carrier: string; tracking: string };
      const order = await app.getOrder.internal(orderId);
      if (order) await notify([order.buyerId], { kind: "order_shipped", title: `Order ${order.number} is on its way`, body: `${carrier} tracking ${tracking}. Confirm when it arrives, or tell us if something's wrong.`, link: `/orders/${order.number}`, email: true }, id);
    },
    ShipmentDelivered: async ({ id, payload }) => {
      const p = payload as { orderId: string; sellerId: string; amount: number };
      await app.escrow.release({ orderId: p.orderId, sellerId: p.sellerId, amount: cents(p.amount) });
      await notify(await shopPeople(p.sellerId), { kind: "funds_released", title: "Delivered: payment released", body: `${usd(p.amount)} (before commission) is in your balance.`, link: "/sell?tab=money", email: false }, id);
    },
    ShipmentRefunded: async ({ id, payload }) => {
      const p = payload as { orderId: string; sellerId: string; amount: number };
      await app.escrow.refund({ orderId: p.orderId, sellerId: p.sellerId, amount: cents(p.amount) });
      const order = await app.getOrder.internal(p.orderId);
      if (order) await notify([order.buyerId], { kind: "refund_approved", title: "Refund approved", body: `${usd(p.amount)} is on its way back to you.`, link: `/orders/${order.number}`, email: true }, id);
      await notify(await shopPeople(p.sellerId), { kind: "refund_approved", title: "A parcel was refunded", body: `A dispute on order ${order?.number ?? ""} was decided for the buyer.`, link: "/sell?tab=orders", email: true }, `${id}:shop`);
    },
    DisputeOpened: async ({ id, payload }) => {
      const p = payload as { orderId: string; sellerId: string };
      const order = await app.getOrder.internal(p.orderId);
      await notify(await shopPeople(p.sellerId), { kind: "dispute_opened", title: `A buyer reported a problem with ${order?.number ?? "an order"}`, body: "The payment stays held until it's sorted. Message the buyer to fix it quickly.", link: "/sell?tab=orders", email: true }, id);
    },
    OrderCompleted: async ({ payload }) => {
      await app.escrow.settle({ orderId: (payload as { orderId: string }).orderId });
    },
    DisbursementSent: async ({ id, payload }) => {
      const p = payload as { kind: "payout" | "refund"; sellerId: string; accountId: string | null; amount: number };
      if (p.kind === "payout") await notify(await shopPeople(p.sellerId), { kind: "payout_sent", title: `${usd(p.amount)} sent to your wallet`, body: "Your payout is on Base. It shows in your wallet within a minute.", link: "/sell?tab=money", email: true }, id);
      else if (p.accountId) await notify([p.accountId], { kind: "refund_sent", title: `${usd(p.amount)} refunded`, body: "Your refund has been sent to your wallet.", link: "/me", email: true }, id);
    },

    // ── Live ──────────────────────────────────────────────────────────────────
    LotSold: async ({ id, payload }) => {
      const p = payload as { winnerId: string; slug: string; amount: number };
      await notify([p.winnerId], { kind: "auction_won", title: `You won it for ${usd(p.amount)}`, body: "The hammer price is held for you for 48 hours. Check out to claim it.", link: `/p/${p.slug}`, email: true }, id);
    },

    // ── Content ───────────────────────────────────────────────────────────────
    QuestionAsked: async ({ id, payload }) => {
      const p = payload as { sellerId: string; productSlug: string };
      await notify(await shopPeople(p.sellerId), { kind: "question", title: "A buyer asked a question", body: "Quick answers sell: they show on the listing for everyone.", link: "/sell?tab=questions", email: false }, id);
    },
    QuestionAnswered: async ({ id, payload }) => {
      const p = payload as { askerId: string | null; productSlug: string };
      if (p.askerId) await notify([p.askerId], { kind: "answer", title: "Your question was answered", body: "The shop replied on the listing.", link: `/p/${p.productSlug}`, email: false }, id);
    },
    ReviewPosted: async ({ id, payload }) => {
      const p = payload as { reviewId: string; productSlug: string; sellerId: string; rating: number };
      await app.ratings.apply(p.reviewId, p.productSlug, p.rating);
      await revalidateTags([productTag(p.productSlug), reviewsTag(p.productSlug), sellerReviewsTag(p.sellerId)]);
      await notify(await shopPeople(p.sellerId), { kind: "review", title: `New ${p.rating}★ review`, body: "A buyer reviewed a delivered order.", link: `/p/${p.productSlug}#reviews`, email: false }, id);
    },

    // ── Sellers ───────────────────────────────────────────────────────────────
    ApplicationApproved: async ({ id, payload }) => {
      const p = payload as { accountId: string; sellerId: string };
      await notify([p.accountId], { kind: "application", title: "Your shop is open", body: "You're verified. Add your first listing: good photos and an honest title sell best.", link: "/sell", email: true }, id);
    },
    ApplicationRejected: async ({ id, payload }) => {
      const p = payload as { accountId: string };
      await notify([p.accountId], { kind: "application", title: "Your application needs a change", body: "We couldn't approve it yet. See what to fix and send it again.", link: "/sell", email: true }, id);
    },
  };
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
    {
      // Lots whose clock ran out while nobody was watching.
      name: "live.lots",
      everyMs: 10_000,
      run: async () => void (await app.live.closeDueLots()),
    },
    {
      // Parcels nobody confirmed or disputed are taken as delivered, which pays the shop.
      name: "shipments.autoconfirm",
      everyMs: DAY / 24,
      run: async () => {
        const n = await app.fulfilment.autoConfirm();
        if (n) jobLog.info("parcels auto-confirmed", { count: n });
      },
    },
    {
      name: "outbox.prune",
      everyMs: DAY / 4,
      run: async () => {
        // Events no handler wants (kept for history) close after a week; delivered ones go after two.
        await dispatcher.retireUnhandled(new Date(Date.now() - 7 * DAY));
        await dispatcher.prune(new Date(Date.now() - 14 * DAY));
      },
    },
    { name: "rate-limits.prune", everyMs: DAY / 24, run: async () => void (await app.rateLimiter.prune(new Date(Date.now() - DAY))) },
  ];
}

export async function buildJobs() {
  const app = await services();
  const dispatcher = new OutboxDispatcher(app.db, eventHandlers(app));
  const scheduler = new Scheduler(app.db, recurringJobs(app, dispatcher));
  return { app, dispatcher, scheduler };
}
