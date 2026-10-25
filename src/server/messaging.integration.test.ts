import { beforeAll, describe, expect, it } from "vitest";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

describe("messaging between shoppers and shops", () => {
  let db: Database;
  let now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network: new SimulatedNetwork(db), simulator: null } });
  const drain = async () => {
    const d = new OutboxDispatcher(db, eventHandlers(app()), { now: () => now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await d.dispatchOnce()).claimed === 0) break;
  };
  const buyer = { accountId: newId(), name: "shopper-b0y3r1" };
  const shopPerson = newId();
  const shop = { side: "shop" as const, accountId: shopPerson, sellerId: "voltgrid" };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
  });

  it("starts a conversation with the first message and keeps both sides' unread marks", async () => {
    expect((await app().messaging.withShop(buyer.accountId, "voltgrid")).conversation).toBeNull();
    expect((await app().messaging.toShop(buyer, "voltgrid", "   ")).ok).toBe(false);
    expect((await app().messaging.toShop(buyer, "no-such-shop", "hi")).ok).toBe(false);

    const first = await app().messaging.toShop(buyer, "voltgrid", "Is the 3 kWh in stock?", "power-station-2kwh");
    if (!first.ok) throw new Error(first.error.message);
    const id = first.value.conversationId;
    expect(first.value.message).toMatchObject({ from: "buyer", productSlug: "power-station-2kwh" });

    // The shop sees one unread chat; the buyer none.
    expect(await app().messaging.unread(shop)).toBe(1);
    expect(await app().messaging.unread({ side: "buyer", ...buyer })).toBe(0);
    const inbox = await app().messaging.shopInbox("voltgrid");
    expect(inbox[0]).toMatchObject({ id, buyerName: buyer.name, unread: true, lastText: "Is the 3 kWh in stock?" });

    now = new Date(now.getTime() + 60_000);
    const reply = await app().messaging.reply(id, shop, "Yes, it leaves Shenzhen tomorrow.");
    expect(reply.ok).toBe(true);
    expect(await app().messaging.unread(shop)).toBe(0); // replying reads the thread
    expect(await app().messaging.unread({ side: "buyer", ...buyer })).toBe(1);
    await app().messaging.markRead(id, { side: "buyer", ...buyer });
    expect(await app().messaging.unread({ side: "buyer", ...buyer })).toBe(0);

    const thread = await app().messaging.withShop(buyer.accountId, "voltgrid");
    expect(thread.messages.map((m) => m.from)).toEqual(["buyer", "shop"]);
    // Only what's new after a time.
    expect((await app().messaging.thread(id, { side: "buyer", ...buyer }, new Date(now.getTime() - 1)))?.messages.map((m) => m.text)).toEqual(["Yes, it leaves Shenzhen tomorrow."]);
  });

  it("keeps conversations private to their shopper and shop", async () => {
    const [c] = await app().messaging.buyerInbox(buyer.accountId);
    expect(await app().messaging.thread(c.id, { side: "buyer", accountId: newId(), name: "x" })).toBeNull();
    expect(await app().messaging.thread(c.id, { side: "shop", accountId: newId(), sellerId: "mei" })).toBeNull();
    expect((await app().messaging.reply(c.id, { side: "shop", accountId: newId(), sellerId: "mei" }, "hi")).ok).toBe(false);
  });

  it("notifies the other side, at most once an hour per conversation", async () => {
    const someone = { accountId: newId(), name: "shopper-n0t1fy" };
    const r = await app().messaging.toShop(someone, "voltgrid", "Hello?");
    if (!r.ok) throw new Error(r.error.message);
    await app().messaging.reply(r.value.conversationId, shop, "Hi!");
    await app().messaging.reply(r.value.conversationId, shop, "How can we help?");
    await drain();
    expect((await app().notifications.list(someone.accountId)).filter((n) => n.kind === "message")).toHaveLength(1);
    now = new Date(now.getTime() + 61 * 60_000);
    await app().messaging.reply(r.value.conversationId, shop, "Still there?");
    await drain();
    expect((await app().notifications.list(someone.accountId)).filter((n) => n.kind === "message")).toHaveLength(2);
  });
});
