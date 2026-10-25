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
      // A creator's video of a sample they were sent closes that deal.
      const video = authorId ? (await app.content.videosByIds([videoId]))[0] : undefined;
      if (authorId && video) await app.samples.videoPosted({ authorId, productSlug: video.productSlug, videoId });
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
      await app.chops.use(order.buyerId, [...new Set(order.lines.map((l) => l.slug))]);
      await app.promos.use(order.buyerId, [...new Set(order.lines.map((l) => l.slug))]);
      await app.sourcing.use(order.buyerId, [...new Set(order.lines.map((l) => l.slug))]);
      // Blind boxes paid for become the buyer's (held ones first, the rest from the case).
      await app.blindBoxes.paid(order.buyerId, orderId, order.lines.map((l) => ({ slug: l.slug, qty: l.qty })));
      // Real sales count into "sold" on the listing and into the rankings.
      if (await app.ratings.sales(orderId, order.lines.map((l) => ({ slug: l.slug, qty: l.qty })))) {
        await revalidateTags([...new Set(order.lines.map((l) => productTag(l.slug)))]);
      }
      // A creator link behind it earns a commission per shop, settled at delivery.
      await app.affiliates.attribute(orderId);
      // A gift waits for its recipient's address before the shop can ship.
      const gift = (await app.gifts.forOrders([orderId])).get(orderId);
      for (const parcel of await app.fulfilment.forOrder(orderId)) {
        const body = gift
          ? `A gift for ${gift.recipientName} in ${order.country}, ${usd(parcel.amount * 100)} held by Protect. We'll tell you when their address is in; then ship it with the card.`
          : `${usd(parcel.amount * 100)} paid and held by Protect. Ship it to ${order.country} and add the tracking number.`;
        await notify(await shopPeople(parcel.sellerId), { kind: "order_paid", title: `New ${gift ? "gift " : ""}order ${order.number}`, body, link: "/sell?tab=orders", email: true }, `${id}:${parcel.sellerId}`);
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
      await app.affiliates.settle(p.orderId, p.sellerId, "earned");
      await notify(await shopPeople(p.sellerId), { kind: "funds_released", title: "Delivered: payment released", body: `${usd(p.amount)} (before commission) is in your balance.`, link: "/sell?tab=money", email: false }, id);
    },
    ShipmentRefunded: async ({ id, payload }) => {
      const p = payload as { orderId: string; sellerId: string; amount: number };
      await app.escrow.refund({ orderId: p.orderId, sellerId: p.sellerId, amount: cents(p.amount) });
      await app.affiliates.settle(p.orderId, p.sellerId, "void");
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
      const p = payload as { kind: "payout" | "creator" | "refund"; sellerId: string; accountId: string | null; amount: number };
      if (p.kind === "creator" && p.accountId) await notify([p.accountId], { kind: "payout_sent", title: `${usd(p.amount)} sent to your wallet`, body: "Your creator earnings are on Base. They show in your wallet within a minute.", link: "/creator", email: true }, id);
      else if (p.kind === "payout") await notify(await shopPeople(p.sellerId), { kind: "payout_sent", title: `${usd(p.amount)} sent to your wallet`, body: "Your payout is on Base. It shows in your wallet within a minute.", link: "/sell?tab=money", email: true }, id);
      else if (p.accountId) await notify([p.accountId], { kind: "refund_sent", title: `${usd(p.amount)} refunded`, body: "Your refund has been sent to your wallet.", link: "/me", email: true }, id);
    },

    ChopCompleted: async ({ id, payload }) => {
      const p = payload as { chopId: string; ownerId: string; slug: string; target: number };
      await notify([p.ownerId], { kind: "chop_done", title: `Chopped to ${usd(p.target)}!`, body: "Your friends got it to the target. It's yours at that price for 48 hours.", link: `/chop/${p.chopId}`, email: true }, id);
    },
    // A new message tells the other side, at most once an hour per conversation.
    MessageSent: async ({ payload }) => {
      const p = payload as { conversationId: string; from: "buyer" | "shop"; buyerId: string; sellerId: string; preview: string; at: string };
      const hour = new Date(p.at).toISOString().slice(0, 13);
      if (p.from === "buyer") {
        await notify(await shopPeople(p.sellerId), { kind: "message", title: "New message from a buyer", body: p.preview, link: `/sell/inbox/${p.conversationId}`, email: true }, `msg:${p.conversationId}:shop:${hour}`);
      } else {
        await notify([p.buyerId], { kind: "message", title: "The shop replied", body: p.preview, link: `/inbox/${p.sellerId}`, email: true }, `msg:${p.conversationId}:buyer:${hour}`);
      }
    },
    // A gift's address is in: its shops can ship, and the sender hears it's been claimed.
    GiftClaimed: async ({ id, payload }) => {
      const p = payload as { orderId: string; senderId: string; recipientName: string; by: "recipient" | "sender" };
      const order = await app.getOrder.internal(p.orderId);
      if (!order) return;
      for (const sellerId of new Set(order.lines.map((l) => l.sellerId))) {
        await notify(await shopPeople(sellerId), { kind: "order_paid", title: `Ship gift ${order.number}`, body: `${p.recipientName}'s address is in. Ship it with the printed card.`, link: "/sell?tab=orders", email: true }, `${id}:${sellerId}`);
      }
      if (p.by === "recipient") await notify([p.senderId], { kind: "gift", title: `${p.recipientName} opened your gift`, body: "They added their address, so it ships next.", link: `/orders/${order.number}`, email: true }, id);
    },
    // Wholesale: shops hear about requests sent to them; buyers about quotes; the shop about a yes.
    RfqOpened: async ({ id, payload }) => {
      const p = payload as { rfqId: string; sellerIds: string[]; item: string; qty: number };
      for (const sellerId of p.sellerIds) {
        await notify(await shopPeople(sellerId), { kind: "rfq", title: "New quote request", body: `${p.qty.toLocaleString("en-US")} × ${p.item}. Quote within 14 days.`, link: `/sell/quotes/${p.rfqId}`, email: true }, `${id}:${sellerId}`);
      }
    },
    QuoteOffered: async ({ id, payload }) => {
      const p = payload as { rfqId: string; buyerId: string; item: string; updated: boolean };
      await notify([p.buyerId], { kind: "rfq", title: p.updated ? "A shop updated its quote" : "You have a new quote", body: p.item, link: `/business#rfq-${p.rfqId}`, email: !p.updated }, id);
    },
    QuoteAccepted: async ({ id, payload }) => {
      const p = payload as { rfqId: string; sellerId: string; item: string };
      await notify(await shopPeople(p.sellerId), { kind: "rfq", title: "Your quote was accepted", body: `${p.item}. The buyer has a week to check out at your price.`, link: `/sell/quotes/${p.rfqId}`, email: true }, id);
    },
    SampleRequested: async ({ id, payload }) => {
      const p = payload as { sellerId: string; slug: string };
      await notify(await shopPeople(p.sellerId), { kind: "sample", title: "A creator asked for a sample", body: "Ship it with tracking, or decline and say why.", link: "/sell/ads#samples-h", email: true }, id);
    },
    SampleShipped: async ({ id, payload }) => {
      const p = payload as { creatorId: string };
      await notify([p.creatorId], { kind: "sample", title: "Your sample is on its way", body: "Post a video with it within 21 days of shipping.", link: "/creator", email: true }, id);
    },
    SampleDeclined: async ({ id, payload }) => {
      const p = payload as { creatorId: string };
      await notify([p.creatorId], { kind: "sample", title: "A sample request was declined", body: "See why in your creator hub.", link: "/creator", email: false }, id);
    },
    SamplePosted: async ({ id, payload }) => {
      const p = payload as { sellerId: string; slug: string };
      await notify(await shopPeople(p.sellerId), { kind: "sample", title: "A creator posted your sample", body: "Their video is live in the feed.", link: `/p/${p.slug}`, email: false }, id);
    },
    TeamFilled: async ({ id, payload }) => {
      const p = payload as { teamId: string; members: string[]; teamPrice: number };
      await notify(p.members, { kind: "team_full", title: `Your team is full: ${usd(p.teamPrice)} each`, body: "The team price is yours for 48 hours. Check out before it runs out.", link: `/team/${p.teamId}`, email: true }, id);
    },
    CommissionEarned: async ({ id, payload }) => {
      const p = payload as { creatorId: string; amount: number };
      await notify([p.creatorId], { kind: "commission", title: `You earned ${usd(p.amount)}`, body: "An order from your link was delivered. It's in your creator balance.", link: "/creator", email: false }, id);
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
      // Today's price of every listing (for price history), then the watches it triggers.
      name: "prices.record",
      everyMs: DAY / 24,
      run: async () => {
        await app.catalog.recordPrices();
        for (const w of await app.engagement.dueWatches((slugs) => app.catalog.currentPrices(slugs))) {
          if (w.addToBag) await app.cart.merge(w.accountId, [{ slug: w.slug, option: null, qty: 1, note: "Price alert" }]);
          await app.notifications.notify(
            [w.accountId],
            { kind: "price_drop", title: `Down to $${w.price.toFixed(2)}`, body: w.addToBag ? "It reached your target, so it's in your bag." : "It reached the price you were waiting for.", link: `/p/${w.slug}`, email: true },
            `price:${w.accountId}:${w.slug}:${Math.round(w.price * 100)}`,
          );
        }
      },
    },
    {
      // Samples shipped without a video after the window lapse.
      name: "samples.lapse",
      everyMs: DAY / 4,
      run: async () => void (await app.samples.lapse()),
    },
    {
      // Drop claims nobody checked out go back into stock; teams that didn't fill close.
      name: "promos.sweep",
      everyMs: 60_000,
      run: async () => void (await app.promos.sweep()),
    },
    {
      // "Remind me": a notification 10 minutes before a drop (or the festival) opens.
      name: "reminders.send",
      everyMs: 60_000,
      run: async () => {
        for (const r of await app.promos.dueReminders()) {
          await app.notifications.notify([r.accountId], { kind: "reminder", title: r.title, body: "Starting soon. Tap to get there first.", link: r.link, email: false }, `reminder:${r.key}:${r.accountId}`);
        }
      },
    },
    {
      // Blind boxes held but not bought go back in the case.
      name: "blindboxes.sweep",
      everyMs: 5 * 60_000,
      run: async () => void (await app.blindBoxes.sweep()),
    },
    {
      // Quote requests close after their two weeks.
      name: "rfqs.expire",
      everyMs: DAY / 24,
      run: async () => void (await app.sourcing.expire()),
    },
    {
      // Chops that ran out of time give their reserved stock back.
      name: "chops.expire",
      everyMs: 5 * 60_000,
      run: async () => void (await app.chops.expire()),
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
