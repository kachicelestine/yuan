import { beforeAll, describe, expect, it } from "vitest";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

// What the leaderboards are made of: units in paid orders per window, saves per window,
// and real sales counted into each listing's "sold", once per order.
describe("rankings data", () => {
  let db: Database;
  let network: SimulatedNetwork;
  let now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network, simulator: network } });

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    network = new SimulatedNetwork(db);
  });

  it("counts units sold in paid orders per window, and adds them to the listing once", async () => {
    const before = (await app().catalog.getProduct("power-bank-20k"))!.sold ?? 0;
    const buyer = newId();
    const r = await app().checkout({ buyerId: buyer, lines: [{ slug: "power-bank-20k", option: null, qty: 3 }], country: "NG", shippingMethod: "standard", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base" });
    if (!r.ok) throw new Error(r.error.message);
    await network.send((await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId))!, now);
    await app().checkInvoice(r.value.invoiceId);

    const day = 86_400_000;
    const sales = await app().getOrder.sales(new Date(now.getTime() - day), new Date(now.getTime() + 1));
    expect(sales.find((s) => s.slug === "power-bank-20k")?.units).toBe(3);
    expect(await app().getOrder.sales(new Date(now.getTime() - 3 * day), new Date(now.getTime() - day))).toEqual([]);

    const dispatch = async () => {
      const d = new OutboxDispatcher(db, eventHandlers(app()), { now: () => now, maxAttempts: 1 });
      for (let i = 0; i < 10; i++) if ((await d.dispatchOnce()).claimed === 0) break;
    };
    await dispatch();
    expect((await app().catalog.getProduct("power-bank-20k"))!.sold).toBe(before + 3);
    // A replayed OrderPaid doesn't count twice.
    expect(await app().ratings.sales(r.value.orderId, [{ slug: "power-bank-20k", qty: 3 }])).toBe(false);
  });

  it("counts saves per window and keeps an item's saved date when the list is rewritten", async () => {
    const a = newId();
    await app().engagement.replaceLists(a, { saved: ["hoodie-heavyweight"], alerts: [], watches: [] });
    now = new Date(now.getTime() + 3 * 86_400_000);
    // Saving another item rewrites the list; the hoodie keeps its first date.
    await app().engagement.replaceLists(a, { saved: ["hoodie-heavyweight", "earbuds-anc"], alerts: [], watches: [] });
    const recent = await app().engagement.savesBetween(new Date(now.getTime() - 86_400_000), new Date(now.getTime() + 60_000));
    expect(recent.get("earbuds-anc")).toBe(1);
    expect(recent.has("hoodie-heavyweight")).toBe(false);
  });
});
