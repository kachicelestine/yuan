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
import { readReferral, referralValue } from "./referrals";
import { seedAll } from "./seed";

// A creator's link brings in an order; delivery pays the creator out of the shop's share;
// a refund voids it; the creator withdraws. Real wiring and handlers on in-memory Postgres.
describe("affiliates: creator links, commissions and creator payouts", () => {
  let db: Database;
  let dir: string;
  let storage: LocalStorage;
  let network: SimulatedNetwork;
  const now = new Date("2026-10-24T10:00:00Z");
  let tag = 0;
  const clock = { now: () => now };
  const app = () => wire(db, { clock, newTag: () => ++tag, payments: { network, simulator: network }, media: { storage, privateStorage: storage, encoder: new CopyEncoder(storage), premoderated: false } });
  const drain = async () => {
    const dispatcher = new OutboxDispatcher(db, eventHandlers(app()), { now: clock.now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await dispatcher.dispatchOnce()).claimed === 0) break;
  };
  const balance = (account: string) => app().ledger.balance(account);

  async function paidOrder(buyerId: string, referral: string | null) {
    const req: CheckoutRequest = {
      buyerId,
      lines: [
        { slug: "hoodie-heavyweight", option: null, qty: 2 },
        { slug: "earbuds-anc", option: null, qty: 1 },
      ],
      country: "NG",
      shippingMethod: "standard",
      combineParcels: true,
      payDutiesNow: true,
      couponId: null,
      rail: "usdc-base",
      referral,
    };
    const r = await app().checkout(req);
    if (!r.ok) throw new Error(r.error.message);
    const invoice = await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId);
    await network.send(invoice!, now);
    await app().checkInvoice(r.value.invoiceId);
    await drain();
    return r.value.orderId;
  }

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    network = new SimulatedNetwork(db);
    dir = await mkdtemp(join(tmpdir(), "lychee-affiliates-"));
    storage = new LocalStorage({ dir, baseUrl: "/media", secret: "test-secret-test-secret-test-secret" });
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("reads the referral cookie only while the window is open", () => {
    const at = new Date("2026-10-20T00:00:00Z");
    expect(readReferral(referralValue("k7m2qx9", at), new Date("2026-10-26T00:00:00Z"))).toBe("k7m2qx9");
    expect(readReferral(referralValue("k7m2qx9", at), new Date("2026-10-28T00:00:01Z"))).toBeNull();
    expect(readReferral("not a code.123")).toBeNull();
    expect(readReferral(undefined)).toBeNull();
  });

  it("pays the creator from the shop's share when the parcel is delivered", async () => {
    const creator = newId();
    const { code } = await app().affiliates.me(creator);
    expect(await app().affiliates.click(code, "hoodie-heavyweight")).toBe(true);
    expect(await app().affiliates.click("zzzzzzz", null)).toBe(false);

    const orderId = await paidOrder(newId(), code);
    const [a, b] = await app().fulfilment.forOrder(orderId);
    // One shop opts out of the programme; the other keeps the default 10%.
    await app().affiliates.setRate(b.sellerId, 0);
    // Attribution already ran when the order was paid, so the opt-out applies to new orders only.
    const before = await app().affiliates.dashboard(creator);
    expect(before.pending).toBeGreaterThan(0);
    expect(before.clicks).toBe(1);

    await app().fulfilment.ship(a.sellerId, orderId, { carrier: "DHL", tracking: "jd014600003" });
    const buyer = (await app().getOrder.internal(orderId))!.buyerId;
    await app().fulfilment.confirm(buyer, orderId, a.sellerId);
    await drain();

    const aCents = money.fromDollars(a.amount);
    const fee = Math.round(aCents * 0.06);
    const commission = Math.floor(aCents * 0.1);
    expect(await balance(`creator:${creator}`)).toBe(-commission);
    expect(await balance(`seller:${a.sellerId}`)).toBe(-(aCents - fee - commission));
    // Replaying the delivery pays nobody twice.
    expect(await app().escrow.release({ orderId, sellerId: a.sellerId, amount: aCents })).toBe(false);
    expect(await balance(`creator:${creator}`)).toBe(-commission);

    const after = await app().affiliates.dashboard(creator);
    expect(after.earned).toBe(commission / 100);
    expect(after.links.find((l) => l.slug === "hoodie-heavyweight")).toMatchObject({ clicks: 1, orders: 1 });
    expect(after.recent.map((c) => c.status).sort()).toEqual(["earned", "pending"]);
    const shop = await app().affiliates.shopProgram(a.sellerId);
    expect(shop).toMatchObject({ rate: 0.1, creators: 1, paid: commission / 100 });

    // The creator hears about it.
    const notes = await app().notifications.list(creator, 10);
    expect(notes.some((n) => n.kind === "commission")).toBe(true);
  });

  it("voids the commission when the parcel is refunded", async () => {
    const creator = newId();
    const { code } = await app().affiliates.me(creator);
    const orderId = await paidOrder(newId(), code);
    const [a] = await app().fulfilment.forOrder(orderId);
    await app().fulfilment.dispute((await app().getOrder.internal(orderId))!.buyerId, orderId, a.sellerId, "not_arrived", null);
    await app().fulfilment.resolve(newId(), orderId, a.sellerId, "refund", "Tracking shows no movement for 30 days.");
    await drain();
    expect(await balance(`creator:${creator}`)).toBe(0);
    expect((await app().affiliates.dashboard(creator)).recent.find((c) => c.sellerId === a.sellerId)?.status).toBe("void");
  });

  it("earns nothing on your own purchases or for a shop you run", async () => {
    const creator = newId();
    const { code } = await app().affiliates.me(creator);
    const orderId = await paidOrder(creator, code);
    expect(await app().affiliates.attribute(orderId)).toEqual([]);
  });

  it("lets a creator withdraw to their wallet through the send-money queue", async () => {
    const creator = newId();
    const { code } = await app().affiliates.me(creator);
    // Enough referred orders to pass the $20 minimum.
    for (let i = 0; i < 3; i++) {
      const orderId = await paidOrder(newId(), code);
      const buyer = (await app().getOrder.internal(orderId))!.buyerId;
      for (const p of await app().fulfilment.forOrder(orderId)) {
        await app().fulfilment.ship(p.sellerId, orderId, { carrier: "DHL", tracking: "jd014600003" });
        await app().fulfilment.confirm(buyer, orderId, p.sellerId);
      }
      await drain();
    }
    const available = await app().escrow.creatorAvailable(creator);
    expect(available).toBeGreaterThan(2000);

    expect((await app().escrow.requestCreatorPayout(creator, available)).ok).toBe(false); // no wallet yet
    expect((await app().affiliates.setWallet(creator, "not-a-wallet")).ok).toBe(false);
    expect((await app().affiliates.setWallet(creator, "0x2222222222222222222222222222222222222222")).ok).toBe(true);
    const payout = await app().escrow.requestCreatorPayout(creator, available);
    expect(payout.ok && payout.value).toMatchObject({ kind: "creator", accountId: creator, sellerId: null, address: "0x2222222222222222222222222222222222222222" });
    expect(await app().escrow.creatorAvailable(creator)).toBe(0);

    const id = payout.ok ? payout.value.id : "";
    expect((await app().escrow.pending()).some((d) => d.id === id)).toBe(true);
    const sent = await app().escrow.markSent(newId(), id, { txHash: `0x${"ab".repeat(32)}`, address: null });
    expect(sent.ok).toBe(true);
    await drain();
    expect((await app().escrow.creatorPayouts(creator)).map((d) => d.status)).toEqual(["sent"]);
    expect((await app().notifications.list(creator, 10)).some((n) => n.kind === "payout_sent")).toBe(true);
  });
});
