import { TEST_ADDRESS } from "./test-address";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CopyEncoder } from "@/modules/content/infrastructure/copy-encoder";
import type { CheckoutRequest } from "@/modules/ordering";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { LocalStorage } from "@/shared/infrastructure/storage/local-storage";
import { money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

// Paid → shipped → delivered (or disputed) → money released, refunded and paid out, with
// the real wiring and the real event handlers, on in-memory Postgres.
describe("Protect: fulfilment, escrow, payouts and notifications", () => {
  let db: Database;
  let dir: string;
  let storage: LocalStorage;
  let network: SimulatedNetwork;
  let now = new Date("2026-10-24T10:00:00Z");
  let tag = 0;
  const clock = { now: () => now };
  const app = () => wire(db, { clock, newTag: () => ++tag, payments: { network, simulator: network }, media: { storage, privateStorage: storage, encoder: new CopyEncoder(storage), premoderated: false } });
  /** Delivers every waiting outbox event to the real handlers. */
  const drain = async () => {
    const dispatcher = new OutboxDispatcher(db, eventHandlers(app()), { now: clock.now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await dispatcher.dispatchOnce()).claimed === 0) break;
  };
  const balance = (account: string) => app().ledger.balance(account);

  /** A paid order from a fresh buyer: a hoodie (one shop) and earbuds (another). */
  async function paidOrder() {
    const buyerId = newId();
    const req: CheckoutRequest = {
      buyerId,
      lines: [
        { slug: "hoodie-heavyweight", option: null, qty: 2 },
        { slug: "earbuds-anc", option: null, qty: 1 },
      ],
      country: "NG",
      delivery: "cheapest",
      combineParcels: true,
      payDutiesNow: true,
      couponId: null,
      rail: "usdc-base", address: TEST_ADDRESS,
    };
    const r = await app().checkout(req);
    if (!r.ok) throw new Error(r.error.message);
    const invoice = await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId);
    await network.send(invoice!, now);
    await app().checkInvoice(r.value.invoiceId);
    return { buyerId, orderId: r.value.orderId, number: r.value.orderNumber, total: r.value.pricing.total };
  }

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    network = new SimulatedNetwork(db);
    dir = await mkdtemp(join(tmpdir(), "lychee-protect-"));
    storage = new LocalStorage({ dir, baseUrl: "/media", secret: "test-secret-test-secret-test-secret" });
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("opens one parcel per shop when an order is paid", async () => {
    const o = await paidOrder();
    const parcels = await app().fulfilment.forOrder(o.orderId);
    expect(parcels.map((p) => p.status)).toEqual(["awaiting_shipment", "awaiting_shipment"]);
    expect(money.fromDollars(parcels.reduce((n, p) => n + p.amount, 0))).toBeLessThan(o.total);
  });

  it("releases each shop's money on delivery, less commission, and closes escrow at the end", async () => {
    const o = await paidOrder();
    const [a, b] = await app().fulfilment.forOrder(o.orderId);
    expect(await balance(`escrow:${o.orderId}`)).toBe(-o.total);

    // A parcel can't be confirmed before it ships, and only its buyer can confirm it.
    expect((await app().fulfilment.confirm(o.buyerId, o.orderId, a.sellerId)).ok).toBe(false);
    expect((await app().fulfilment.ship(a.sellerId, o.orderId, { carrier: "DHL", tracking: "bad" })).ok).toBe(false);
    expect((await app().fulfilment.ship(a.sellerId, o.orderId, { carrier: "DHL", tracking: "jd014600003"})).ok).toBe(true);
    expect((await app().fulfilment.confirm(newId(), o.orderId, a.sellerId)).ok).toBe(false);
    const confirmed = await app().fulfilment.confirm(o.buyerId, o.orderId, a.sellerId);
    expect(confirmed.ok && confirmed.value.confirmedBy).toBe("buyer");
    await drain();

    const aCents = money.fromDollars(a.amount);
    const fee = Math.round(aCents * 0.06);
    expect(await balance(`seller:${a.sellerId}`)).toBe(-(aCents - fee));
    expect(await balance("platform:commission")).toBeLessThanOrEqual(-fee);
    expect(await balance(`escrow:${o.orderId}`)).toBe(-(o.total - aCents));

    // The second shop ships and nobody confirms: 21 days later it confirms itself.
    await app().fulfilment.ship(b.sellerId, o.orderId, { carrier: "EMS", tracking: "EE123456789CN" });
    now = new Date(now.getTime() + 22 * 86_400_000);
    expect(await app().fulfilment.autoConfirm()).toBeGreaterThanOrEqual(1);
    await drain();
    expect((await app().getOrder.byNumber(o.number, o.buyerId))?.status).toBe("completed");
    // Every cent left escrow: to the shops, to commission, and the rest to logistics.
    expect(await balance(`escrow:${o.orderId}`)).toBe(0);

    // Delivered events are idempotent: replaying them doesn't pay twice.
    expect(await app().escrow.release({ orderId: o.orderId, sellerId: a.sellerId, amount: aCents })).toBe(false);
  });

  it("refunds a disputed parcel to the buyer through the send-money queue", async () => {
    const o = await paidOrder();
    const [a, b] = await app().fulfilment.forOrder(o.orderId);
    const d = await app().fulfilment.dispute(o.buyerId, o.orderId, a.sellerId, "not_arrived", null);
    expect(d.ok && d.value.status).toBe("disputed");
    expect((await app().fulfilment.disputes()).map((x) => x.orderNumber)).toContain(o.number);
    expect((await app().fulfilment.resolve(newId(), o.orderId, a.sellerId, "refund", "ok")).ok).toBe(false);
    const decided = await app().fulfilment.resolve(newId(), o.orderId, a.sellerId, "refund", "Tracking shows no movement for 30 days.");
    expect(decided.ok && decided.value.status).toBe("refunded");
    await drain();

    const refund = (await app().escrow.pending()).find((x) => x.kind === "refund" && x.orderId === o.orderId);
    expect(refund).toMatchObject({ sellerId: a.sellerId, amount: a.amount, address: null });
    expect(refund?.paymentTx).toBeTruthy();
    const admin = newId();
    expect((await app().escrow.markSent(admin, refund!.id, { txHash: "0x123", address: null })).ok).toBe(false);
    const sent = await app().escrow.markSent(admin, refund!.id, { txHash: `0x${"ab".repeat(32)}`, address: `0x${"12".repeat(20)}` });
    expect(sent.ok && sent.value.status).toBe("sent");
    expect(await balance("pending:refunds")).toBe(0);

    // The other shop still gets paid, and the order completes.
    await app().fulfilment.ship(b.sellerId, o.orderId, { carrier: "UPS", tracking: "1Z999AA10123456784" });
    await app().fulfilment.confirm(o.buyerId, o.orderId, b.sellerId);
    await drain();
    expect((await app().getOrder.byNumber(o.number, o.buyerId))?.status).toBe("completed");
    expect(await balance(`escrow:${o.orderId}`)).toBe(0);
  });

  it("pays a shop out to its wallet, or returns the money when a payout is cancelled", async () => {
    // A shop with an approved application (and so a payout wallet) and a delivered sale.
    const owner = newId();
    const handle = "protect-shop";
    const ob = app().onboarding;
    await ob.saveDetails(owner, { name: "Protect Shop", handle, kind: "Maker", country: "GH", city: "Accra", address: "1 Market Street, Accra", phone: "+233 20 000 0000", website: null, yearsInBusiness: 2, description: "Things that get delivered and paid for, eventually." }, `0x${"34".repeat(20)}`);
    for (const kind of ["business_license", "id_front"] as const) {
      const t = await ob.startDocument(owner, { kind, contentType: "image/jpeg", bytes: 4 });
      if (!t.ok) throw new Error(t.error.message);
      await storage.receive(storage.verify(new URL(t.value.url, "http://x").searchParams)!, new Blob([new Uint8Array(4)]).stream());
      await ob.attachDocument(owner, { kind, key: t.value.key });
    }
    const s = await ob.submit(owner);
    if (!s.ok) throw new Error(s.error.message);
    await ob.approve(newId(), s.value.id);
    // Credit the shop as if a parcel had been released.
    await app().escrow.release({ orderId: newId(), sellerId: handle, amount: money.fromDollars(100) });
    expect(await app().escrow.available(handle)).toBe(9400);

    expect((await app().escrow.requestPayout(handle, money.fromDollars(10))).ok).toBe(false);
    expect((await app().escrow.requestPayout(handle, money.fromDollars(500))).ok).toBe(false);
    const p = await app().escrow.requestPayout(handle, money.fromDollars(50));
    if (!p.ok) throw new Error(p.error.message);
    expect(p.value.address).toBe(`0x${"34".repeat(20)}`);
    expect(await app().escrow.available(handle)).toBe(4400);

    const admin = newId();
    expect((await app().escrow.cancelPayout(admin, p.value.id, "Wallet is on the wrong network")).ok).toBe(true);
    expect(await app().escrow.available(handle)).toBe(9400);

    const p2 = await app().escrow.requestPayout(handle, money.fromDollars(94));
    if (!p2.ok) throw new Error(p2.error.message);
    // A transaction already recorded (the refund above) can't be reused for this payout.
    const reused = await app().escrow.markSent(admin, p2.value.id, { txHash: `0x${"ab".repeat(32)}`, address: null });
    expect(reused.ok || reused.error.code).toBe("invalid_tx");
    const sent = await app().escrow.markSent(admin, p2.value.id, { txHash: `0x${"cd".repeat(32)}`, address: null });
    expect(sent.ok).toBe(true);
    expect(await app().escrow.available(handle)).toBe(0);
    expect(await balance("pending:payouts")).toBe(0);
    await drain();

    // The owner heard about the approval and the payout.
    const notes = await app().notifications.list(owner);
    expect(notes.map((n) => n.kind)).toEqual(expect.arrayContaining(["application", "payout_sent"]));
    expect(await app().notifications.unread(owner)).toBeGreaterThanOrEqual(2);
    await app().notifications.markAllRead(owner);
    expect(await app().notifications.unread(owner)).toBe(0);
  });

  it("lets a buyer review only what was delivered, once, and updates the product's rating", async () => {
    const o = await paidOrder();
    const actor = { accountId: o.buyerId, name: "shopper-rev", avatar: "" };
    const early = await app().interactions.postReview(actor, { orderId: o.orderId, productSlug: "hoodie-heavyweight", rating: 5, text: "Thick, warm and true to size." });
    expect(early.ok || early.error.code).toBe("not_purchased");

    const parcels = await app().fulfilment.forOrder(o.orderId);
    for (const p of parcels) {
      await app().fulfilment.ship(p.sellerId, o.orderId, { carrier: "DHL", tracking: "JD0146000099" });
      await app().fulfilment.confirm(o.buyerId, o.orderId, p.sellerId);
    }
    const before = await app().catalog.getProduct("hoodie-heavyweight");
    const r = await app().interactions.postReview(actor, { orderId: o.orderId, productSlug: "hoodie-heavyweight", rating: 1, text: "Shrank after one wash, sadly." });
    expect(r.ok).toBe(true);
    const twice = await app().interactions.postReview(actor, { orderId: o.orderId, productSlug: "hoodie-heavyweight", rating: 5, text: "Changed my mind entirely." });
    expect(twice.ok || twice.error.code).toBe("already_reviewed");
    await drain();
    const after = await app().catalog.getProduct("hoodie-heavyweight");
    expect(after!.reviews).toBe(before!.reviews + 1);
    expect(after!.rating).toBeLessThanOrEqual(before!.rating);
    expect((await app().content.reviewsForProduct("hoodie-heavyweight", 100)).some((x) => x.text.startsWith("Shrank") && x.verified)).toBe(true);
  });
});
