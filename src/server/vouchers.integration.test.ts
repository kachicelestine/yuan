import { TEST_ADDRESS } from "./test-address";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CopyEncoder } from "@/modules/content/infrastructure/copy-encoder";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { LocalStorage } from "@/shared/infrastructure/storage/local-storage";
import { money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

// A shop's own voucher is paid for by that shop: its parcel is released less the discount,
// and the platform's promotions account isn't touched. A platform coupon is the reverse.
describe("shop vouchers", () => {
  let db: Database;
  let dir: string;
  let storage: LocalStorage;
  let network: SimulatedNetwork;
  const now = new Date("2026-10-27T10:00:00Z");
  const clock = { now: () => now };
  const app = () => wire(db, { clock, payments: { network, simulator: network }, media: { storage, privateStorage: storage, encoder: new CopyEncoder(storage), premoderated: false } });
  const drain = async () => {
    const dispatcher = new OutboxDispatcher(db, eventHandlers(app()), { now: clock.now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await dispatcher.dispatchOnce()).claimed === 0) break;
  };
  const balance = (account: string) => app().ledger.balance(account);

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    network = new SimulatedNetwork(db);
    dir = await mkdtemp(join(tmpdir(), "lychee-vouchers-"));
    storage = new LocalStorage({ dir, baseUrl: "/media", secret: "test-secret-test-secret-test-secret" });
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  async function buyWith(couponId: string) {
    const buyerId = newId();
    expect(await app().engagement.claimCoupons(buyerId, [couponId])).toEqual([couponId]);
    const r = await app().checkout({
      buyerId,
      // Two hoodies from Canton Street Lab and earbuds from another shop.
      lines: [
        { slug: "hoodie-heavyweight", option: null, qty: 2 },
        { slug: "earbuds-anc", option: null, qty: 1 },
      ],
      country: "NG",
      delivery: "cheapest",
      combineParcels: true,
      payDutiesNow: true,
      couponId,
      rail: "usdc-base",
      address: TEST_ADDRESS,
    });
    if (!r.ok) throw new Error(r.error.message);
    const invoice = await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId);
    await network.send(invoice!, now);
    await app().checkInvoice(r.value.invoiceId);
    return { buyerId, orderId: r.value.orderId, discount: r.value.pricing.discount };
  }

  async function deliverAll(buyerId: string, orderId: string) {
    for (const p of await app().fulfilment.forOrder(orderId)) {
      await app().fulfilment.ship(p.sellerId, orderId, { carrier: "DHL", tracking: "jd014600003" });
      await app().fulfilment.confirm(buyerId, orderId, p.sellerId);
    }
    await drain();
  }

  it("takes a shop's voucher out of that shop's parcel, and leaves promotions alone", async () => {
    const voucher = await app().coupons.issue("streetlab", { kind: "amount", value: 10, minSpend: 20, title: "$10 off", detail: "", days: 7 });
    if (!voucher.ok) throw new Error(voucher.error.message);
    const promotionsBefore = await balance("platform:promotions");

    const o = await buyWith(voucher.value.id);
    expect(o.discount).toBe(1000);
    const parcels = await app().fulfilment.forOrder(o.orderId);
    const street = parcels.find((p) => p.sellerId === "streetlab")!;
    const other = parcels.find((p) => p.sellerId !== "streetlab")!;
    const order = await app().getOrder.internal(o.orderId);
    // Order views are in dollars; parcels are compared in cents.
    const lines = (seller: string) => order!.lines.filter((l) => l.sellerId === seller).reduce((n, l) => n + money.fromDollars(l.unitPrice) * l.qty, 0);
    // The shop's parcel is its lines less the voucher; the other shop's is untouched.
    expect(money.fromDollars(street.amount)).toBe(lines("streetlab") - 1000);
    expect(money.fromDollars(other.amount)).toBe(lines(other.sellerId));

    await deliverAll(o.buyerId, o.orderId);
    expect(await balance(`escrow:${o.orderId}`)).toBe(0);
    expect(await balance("platform:promotions")).toBe(promotionsBefore);
  });

  it("still books a platform coupon as a promotion", async () => {
    const coupon = await app().coupons.issue(null, { kind: "amount", value: 5, minSpend: 20, title: "$5 off", detail: "", days: 7 });
    if (!coupon.ok) throw new Error(coupon.error.message);
    const promotionsBefore = await balance("platform:promotions");
    const o = await buyWith(coupon.value.id);
    const parcels = await app().fulfilment.forOrder(o.orderId);
    const order = await app().getOrder.internal(o.orderId);
    expect(parcels.reduce((n, p) => n + money.fromDollars(p.amount), 0)).toBe(order!.lines.reduce((n, l) => n + money.fromDollars(l.unitPrice) * l.qty, 0));
    await deliverAll(o.buyerId, o.orderId);
    expect(await balance(`escrow:${o.orderId}`)).toBe(0);
    expect(await balance("platform:promotions")).toBe(promotionsBefore + 500);
  });
});
