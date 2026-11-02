import { beforeAll, describe, expect, it } from "vitest";
import type { CheckoutRequest } from "@/modules/ordering";
import { festivalWindow } from "@/modules/engagement";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { settleDepositMoney } from "./deposits";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";
import { TEST_ADDRESS } from "./test-address";

// Pre-sales and pre-orders: a deposit now (held by Protect, nothing ships), the balance
// at the credited price in its window, and the deposit reaching the shop with delivery.
describe("deposits", () => {
  let db: Database;
  let network: SimulatedNetwork;
  let now = new Date("2026-10-25T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network, simulator: network } });
  const slug = "power-station-2kwh";
  const shop = "voltgrid";
  const festival = festivalWindow(2026);
  const drain = async () => {
    const d = new OutboxDispatcher(db, eventHandlers(app()), { now: () => now, maxAttempts: 1 });
    for (let i = 0; i < 20; i++) if ((await d.dispatchOnce()).claimed === 0) break;
  };
  const pay = async (invoiceId: string) => {
    await network.send((await new DrizzleInvoiceRepository(db).findById(invoiceId))!, now);
    await app().checkInvoice(invoiceId);
    await drain();
  };
  /** Puts a deposit down and pays it, like the action does. */
  const deposit = async (buyerId: string, offerId: string, paid = true) => {
    const r = await app().deposits.reserve(buyerId, offerId);
    if (!r.ok) return r;
    const order = await app().depositCheckout({ buyerId, slug: r.value.offer.slug, amount: r.value.offer.deposit, country: "NG", rail: "usdc-base" });
    if (!order.ok) throw new Error(order.error.message);
    await app().deposits.attachOrder(r.value.deposit.id, order.value.orderId);
    if (paid) await pay(order.value.invoiceId);
    return { ok: true as const, ...order.value };
  };
  const buy = (buyerId: string, qty = 1): CheckoutRequest => ({ buyerId, lines: [{ slug, option: null, qty }], country: "NG", address: TEST_ADDRESS, delivery: "cheapest", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base" });
  const presale = () =>
    app().deposits.createOffer(shop, {
      slug,
      kind: "presale",
      title: "11.11 pre-sale: power station",
      blurb: "Put down $10, it counts as $30 on 11.11.",
      deposit: money.fromDollars(10),
      credit: money.fromDollars(30),
      price: money.fromDollars(599),
      opensAt: new Date(now.getTime() - 3_600_000),
      closesAt: festival.from,
      balanceFrom: festival.from,
      balanceUntil: festival.until,
      stock: 2,
      perPerson: 1,
    });

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    network = new SimulatedNetwork(db);
  });

  it("checks offers: the shop's own listing, sane amounts and windows", async () => {
    const notTheirs = await app().deposits.createOffer("sunvolt", { slug, kind: "preorder", title: "Nope", blurb: "", deposit: 1000, credit: 1000, price: 59900, opensAt: now, closesAt: festival.from, balanceFrom: festival.from, balanceUntil: festival.until, stock: 5, perPerson: 1 } as never);
    expect(!notTheirs.ok && notTheirs.error.code).toBe("invalid_offer");
    const tooRich = await app().deposits.createOffer(shop, { slug, kind: "presale", title: "Too rich", blurb: "", deposit: 1000, credit: 9000, price: 59900, opensAt: now, closesAt: festival.from, balanceFrom: festival.from, balanceUntil: festival.until, stock: 5, perPerson: 1 } as never);
    expect(!tooRich.ok && tooRich.error.code).toBe("invalid_offer"); // more than 5x the deposit
  });

  it("takes a deposit that ships nothing, then sells the balance at the credited price on 11.11", async () => {
    const offer = await presale();
    if (!offer.ok) throw new Error(offer.error.message);
    const ada = newId();
    const placed = await deposit(ada, offer.value.id);
    if (!placed.ok) throw new Error("deposit failed");
    expect(await app().fulfilment.forOrder(placed.orderId)).toEqual([]); // nothing to ship
    expect((await app().getOrder.internal(placed.orderId))?.kind).toBe("deposit");
    expect((await app().notifications.list(ada)).map((n) => n.title)).toContain("Deposit paid");
    // One per person.
    const again = await app().deposits.reserve(ada, offer.value.id);
    expect(!again.ok && again.error.code).toBe("limit_reached");

    // Before the festival the listing costs what it costs.
    const early = await app().checkout(buy(ada));
    expect(early.ok && early.value.pricing.subtotal).toBe(money.fromDollars(599));

    now = new Date(festival.from.getTime() + 3_600_000);
    expect((await app().deposits.dueReminders()).map((r) => r.buyerId)).toEqual([ada]);
    expect(await app().deposits.dueReminders()).toEqual([]); // told once
    const balance = await app().checkout(buy(ada));
    if (!balance.ok) throw new Error(balance.error.message);
    expect(balance.value.pricing.subtotal).toBe(money.fromDollars(569)); // 599 − 30
    await pay(balance.value.invoiceId);
    const two = await app().checkout(buy(ada, 2));
    expect(two.ok && two.value.pricing.subtotal).toBe(money.fromDollars(599 * 2)); // used up

    // Delivery pays the shop the balance and the deposit.
    const before = await app().escrow.available(shop);
    expect((await app().fulfilment.ship(shop, balance.value.orderId, { carrier: "DHL", tracking: "DHL123456789" })).ok).toBe(true);
    await drain();
    expect((await app().fulfilment.confirm(ada, balance.value.orderId, shop)).ok).toBe(true);
    await drain();
    const gained = (await app().escrow.available(shop)) - before;
    expect(gained).toBeGreaterThan(money.fromDollars(569) * 0.8);
    expect(gained).toBeGreaterThan(0);
    expect((await app().getOrder.internal(placed.orderId))?.status).toBe("completed");
  });

  it("gives the deposit to the shop when the balance window passes unpaid", async () => {
    now = new Date("2026-10-25T12:00:00Z");
    const offer = await app().deposits.createOffer(shop, { slug, kind: "preorder", title: "2027 batch pre-order", blurb: "", deposit: money.fromDollars(50), credit: money.fromDollars(50), price: money.fromDollars(599), opensAt: new Date(now.getTime() - 60_000), closesAt: new Date(now.getTime() + 86_400_000), balanceFrom: new Date(now.getTime() + 2 * 86_400_000), balanceUntil: new Date(now.getTime() + 4 * 86_400_000), stock: 5, perPerson: 2 });
    if (!offer.ok) throw new Error(offer.error.message);
    const ben = newId();
    const placed = await deposit(ben, offer.value.id);
    if (!placed.ok) throw new Error("deposit failed");
    const before = await app().escrow.available(shop);
    now = new Date(now.getTime() + 5 * 86_400_000);
    const lapsed = await app().deposits.forfeitLapsed();
    expect(lapsed.map((d) => d.buyerId)).toEqual([ben]);
    for (const d of lapsed) await settleDepositMoney(app(), d, "release");
    expect((await app().escrow.available(shop)) - before).toBeGreaterThan(0);
    expect(await app().deposits.forfeitLapsed()).toEqual([]);
  });

  it("refunds every paid deposit when the shop cancels, and gives back a place whose payment lapsed", async () => {
    now = new Date("2026-10-26T12:00:00Z");
    const offer = await presale();
    if (!offer.ok) throw new Error(offer.error.message);
    const [cy, dee] = [newId(), newId()];
    const paid = await deposit(cy, offer.value.id);
    const unpaid = await deposit(dee, offer.value.id, false);
    if (!paid.ok || !unpaid.ok) throw new Error("deposit failed");
    const full = await app().deposits.reserve(newId(), offer.value.id);
    expect(!full.ok && full.error.code).toBe("sold_out"); // stock 2

    // The unpaid one's invoice lapses: its place comes back.
    now = new Date(now.getTime() + 2 * 3_600_000);
    await app().syncInvoices();
    await drain();
    expect((await app().deposits.current(null)).find((o) => o.id === offer.value.id)?.left).toBe(1);

    const cancelled = await app().deposits.cancelOffer(shop, offer.value.id);
    if (!cancelled.ok) throw new Error(cancelled.error.message);
    expect(cancelled.value.refunds.map((r) => r.buyerId)).toEqual([cy]);
    for (const r of cancelled.value.refunds) await settleDepositMoney(app(), r, "refund");
    const queue = await app().escrow.pending();
    expect(queue.some((d) => d.kind === "refund" && d.orderId === paid.orderId)).toBe(true);
  });
});
