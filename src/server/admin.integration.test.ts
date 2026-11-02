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
import { newId } from "@/shared/kernel";
import { auditLog, recordAdmin } from "./admin/audit";
import { campaignList, ledgerSummary, LISTING_FILTERS, listings, ORDER_FILTERS, orderList, overview, shops, showList, users, videoList } from "./admin/queries";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

// What admins do, with the real wiring on in-memory Postgres: take listings down, suspend
// shops, refund parcels outright, run coupons, and read every corner of the platform.
describe("admin panel", () => {
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
  const adminId = newId();

  async function paidOrder(slug: string) {
    const buyerId = newId();
    const r = await app().checkout({ buyerId, lines: [{ slug, option: null, qty: 1 }], country: "NG", delivery: "cheapest", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base", address: TEST_ADDRESS });
    if (!r.ok) throw new Error(r.error.message);
    const invoice = await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId);
    await network.send(invoice!, now);
    await app().checkInvoice(r.value.invoiceId);
    return { buyerId, orderId: r.value.orderId, number: r.value.orderNumber };
  }

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    network = new SimulatedNetwork(db);
    dir = await mkdtemp(join(tmpdir(), "lychee-admin-"));
    storage = new LocalStorage({ dir, baseUrl: "/media", secret: "test-secret-test-secret-test-secret" });
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("takes a listing down with a note the seller sees, and only an admin puts it back", async () => {
    const [listing] = (await app().selling.listings("streetlab")).filter((l) => l.status === "active");
    const removed = await app().catalogAdmin.removeListing(listing.id, "Uses a brand's logo without permission.");
    expect(removed.ok && removed.value.slug).toBe(listing.slug);
    expect(await app().catalog.getProduct(listing.slug)).toBeNull();

    // The seller sees why, and can't switch it back on or save their way around it.
    const mine = await app().selling.listing("streetlab", listing.id);
    expect(mine).toMatchObject({ status: "removed", moderationNote: "Uses a brand's logo without permission." });
    expect((await app().selling.setStatus("streetlab", listing.id, "active")).ok).toBe(false);

    expect((await app().catalogAdmin.removeListing(listing.id, "no")).ok).toBe(false);
    expect((await app().catalogAdmin.restoreListing(listing.id)).ok).toBe(true);
    expect((await app().catalog.getProduct(listing.slug))?.slug).toBe(listing.slug);
    expect((await app().selling.listing("streetlab", listing.id))?.moderationNote).toBeNull();
  });

  it("suspends a shop: its page, listings and shop search go dark, and come back on restore", async () => {
    // A shop with a few live listings.
    let shop = "";
    for (const s of await app().catalog.listSellers()) if ((await app().selling.listings(s.id)).filter((l) => l.status === "active").length >= 3) shop = s.id;
    const before = (await app().selling.listings(shop)).filter((l) => l.status === "active").length;
    const name = (await app().catalog.getSeller(shop))!.seller.name;
    expect((await app().searchShops(name, 10)).map((s) => s.id)).toContain(shop);
    // One listing was taken down separately; lifting the suspension must not bring it back.
    const [taken] = (await app().selling.listings(shop)).filter((l) => l.status === "active");
    await app().catalogAdmin.removeListing(taken.id, "Wrong category and misleading photos.");

    const r = await app().catalogAdmin.suspendShop(shop, "Repeated counterfeit reports.", now);
    expect(r.ok && r.value.listings).toBe(before - 1);
    expect(await app().catalog.getSeller(shop)).toBeNull();
    expect(await app().catalog.suspension(shop)).toMatchObject({ reason: "Repeated counterfeit reports." });
    expect((await app().catalog.listSellers()).map((s) => s.id)).not.toContain(shop);
    expect((await app().catalog.listProducts({ seller: shop })).length).toBe(0);
    expect((await app().searchShops(name, 10)).map((s) => s.id)).not.toContain(shop);
    const [locked] = (await app().selling.listings(shop)).filter((l) => l.status === "suspended");
    expect((await app().selling.setStatus(shop, locked.id, "active")).ok).toBe(false);

    const back = await app().catalogAdmin.restoreShop(shop);
    expect(back.ok && back.value.listings).toBe(before - 1);
    expect((await app().catalog.getSeller(shop))?.seller.id).toBe(shop);
    expect((await app().selling.listing(shop, taken.id))?.status).toBe("removed");
    await app().catalogAdmin.restoreListing(taken.id);
  });

  it("refunds an unshipped parcel outright, through the send-money queue", async () => {
    const o = await paidOrder("hoodie-heavyweight");
    const [parcel] = await app().fulfilment.forOrder(o.orderId);
    expect((await app().fulfilment.refund(adminId, o.orderId, parcel.sellerId, "no")).ok).toBe(false);
    const r = await app().fulfilment.refund(adminId, o.orderId, parcel.sellerId, "The shop was suspended before shipping.");
    expect(r.ok && r.value.status).toBe("refunded");
    await drain();
    expect((await app().escrow.pending()).find((x) => x.kind === "refund" && x.orderId === o.orderId)).toMatchObject({ amount: parcel.amount });
    // A settled parcel can't be refunded twice.
    expect((await app().fulfilment.refund(adminId, o.orderId, parcel.sellerId, "Second attempt at a refund.")).ok).toBe(false);
  });

  it("refunds parcels a shop never ships within the deadline", async () => {
    const o = await paidOrder("hoodie-heavyweight");
    // Still within the deadline: nothing happens.
    expect(await app().fulfilment.refundOverdue()).toBe(0);
    const later = wire(db, { clock: { now: () => new Date(now.getTime() + 16 * 86_400_000) }, payments: { network, simulator: network }, media: { storage, privateStorage: storage, encoder: new CopyEncoder(storage), premoderated: false } });
    expect(await later.fulfilment.refundOverdue()).toBeGreaterThanOrEqual(1);
    const [parcel] = await later.fulfilment.forOrder(o.orderId);
    expect(parcel.status).toBe("refunded");
    const at = new Date(now.getTime() + 16 * 86_400_000);
    const dispatcher = new OutboxDispatcher(db, eventHandlers(later), { now: () => at, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await dispatcher.dispatchOnce()).claimed === 0) break;
    expect((await later.escrow.pending()).some((x) => x.kind === "refund" && x.orderId === o.orderId)).toBe(true);
  });

  it("issues platform coupons and shop vouchers, counts claims, and ends them", async () => {
    const desk = app().coupons;
    expect(await desk.issue(null, { kind: "amount", value: 50, minSpend: 20, title: "$50 off", detail: "", days: 7 })).toMatchObject({ ok: false, error: { code: "invalid_coupon" } });
    expect(await desk.issue(null, { kind: "percent", value: 0.9, minSpend: 0, title: "90% off", detail: "", days: 7 })).toMatchObject({ ok: false });
    expect(await desk.issue(null, { kind: "amount", value: 5, minSpend: 30, title: "$5 off", detail: "", days: 0 })).toMatchObject({ ok: false });

    const platform = await desk.issue(null, { kind: "amount", value: 5, minSpend: 30, title: "$5 off", detail: "Any order over $30", days: 14 });
    if (!platform.ok) throw new Error(platform.error.message);
    expect(platform.value).toMatchObject({ sellerId: null, value: 5, minSpend: 30 });
    expect((await app().engagement.activeCoupons()).map((c) => c.id)).toContain(platform.value.id);

    const voucher = await desk.issue("streetlab", { kind: "percent", value: 0.12, minSpend: 40, title: "12% off", detail: "", days: 10 });
    if (!voucher.ok) throw new Error(voucher.error.message);
    expect(voucher.value).toMatchObject({ sellerId: "streetlab", value: 0.12, detail: "On this shop's items" });
    expect((await desk.runningForSeller("streetlab")).map((c) => c.id)).toContain(voucher.value.id);

    const buyer = newId();
    expect(await app().engagement.claimCoupons(buyer, [voucher.value.id])).toEqual([voucher.value.id]);
    expect((await desk.forSeller("streetlab")).find((c) => c.id === voucher.value.id)).toMatchObject({ claimed: 1, used: 0, running: true });

    // Another shop can't end it; its own shop (or an admin) can.
    expect((await desk.end(voucher.value.id, "pals")).ok).toBe(false);
    expect((await desk.end(voucher.value.id, "streetlab")).ok).toBe(true);
    expect((await desk.runningForSeller("streetlab")).map((c) => c.id)).not.toContain(voucher.value.id);
    expect(await app().engagement.usableCoupon(buyer, voucher.value.id)).toBeNull();
    expect((await desk.all()).find((c) => c.id === voucher.value.id)?.running).toBe(false);
  });

  it("keeps an audit log, newest first, and narrows it to one thing", async () => {
    await recordAdmin(db, { adminId, action: "shop.suspend", targetType: "shop", targetId: "pals", note: "Repeated counterfeit reports.", at: new Date(now.getTime() - 60_000) });
    await recordAdmin(db, { adminId, action: "shop.restore", targetType: "shop", targetId: "pals", at: now });
    await recordAdmin(db, { adminId, action: "coupon.end", targetType: "coupon", targetId: "glow3", at: now });
    const pals = await auditLog(db, { target: { type: "shop", id: "pals" } });
    expect(pals.map((e) => e.action)).toEqual(["shop.restore", "shop.suspend"]);
    expect((await auditLog(db, { limit: 1 })).length).toBe(1);
  });

  it("reads every section of the panel", async () => {
    const o = await overview(db, now);
    expect(o.shops).toBeGreaterThan(5);
    expect(o.liveListings).toBeGreaterThan(10);
    expect(o.paidOrders).toBeGreaterThanOrEqual(1);
    expect(o.gmv).toBeGreaterThan(0);

    expect((await shops(db, now, "street")).map((s) => s.id)).toContain("streetlab");
    for (const status of LISTING_FILTERS) await listings(db, "", status);
    expect((await listings(db, "hoodie")).length).toBeGreaterThan(0);
    for (const f of ORDER_FILTERS) await orderList(db, "", f);
    const paid = await orderList(db, "", "paid");
    expect(paid[0]?.parcels.length).toBeGreaterThan(0);
    // Search treats wildcards literally.
    expect(await users(db, "%")).toEqual([]);
    await Promise.all([videoList(db, "dumplings"), showList(db), campaignList(db, now), ledgerSummary(db)]);
    expect((await ledgerSummary(db)).find((l) => l.account === "pending:refunds")?.balance).toBeLessThan(0);
  });
});
