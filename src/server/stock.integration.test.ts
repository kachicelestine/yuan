import { TEST_ADDRESS } from "./test-address";
import { beforeAll, describe, expect, it } from "vitest";
import { DrizzleProductRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repositories";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

// Stock: a listing that counts it can't be oversold. Checkout takes units in the order's own
// transaction, an order that lapses gives them back, and a late payment takes them again.
describe("stock levels", () => {
  let db: Database;
  let network: SimulatedNetwork;
  const now = new Date("2026-10-28T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network, simulator: network } });
  const products = () => new DrizzleProductRepository(db);
  const stockOf = async (slug: string) => (await products().findBySlug(slug))?.stock ?? null;

  async function setStock(slug: string, stock: number | null, soldOut: string[] = []) {
    const p = (await products().findBySlug(slug))!;
    await products().save({ ...p, stock, options: p.options.map((o) => ({ ...o, values: o.values.map((v) => ({ ...v, soldOut: soldOut.includes(v.label) })) })) });
  }

  const checkout = (slug: string, qty: number, option: string | null = null) =>
    app().checkout({ buyerId: newId(), lines: [{ slug, option, qty }], country: "NG", shippingMethod: "standard", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base", address: TEST_ADDRESS });

  async function pay(invoiceId: string) {
    const invoice = await new DrizzleInvoiceRepository(db).findById(invoiceId);
    await network.send(invoice!, now);
    await app().checkInvoice(invoiceId);
  }

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    network = new SimulatedNetwork(db);
  });

  it("leaves listings that don't count stock alone", async () => {
    expect(await stockOf("earbuds-anc")).toBeNull();
    expect((await checkout("earbuds-anc", 40)).ok).toBe(true);
    expect(await stockOf("earbuds-anc")).toBeNull();
  });

  it("never sells more than it has, and says how many are left", async () => {
    await setStock("earbuds-anc", 2);
    expect(await checkout("earbuds-anc", 3)).toMatchObject({ ok: false, error: { code: "out_of_stock", message: expect.stringMatching(/Only 2 left/) } });
    const first = await checkout("earbuds-anc", 2);
    expect(first.ok).toBe(true);
    expect(await stockOf("earbuds-anc")).toBe(0);
    expect(await checkout("earbuds-anc", 1)).toMatchObject({ ok: false, error: { code: "out_of_stock", message: expect.stringMatching(/sold out/) } });
    expect((await app().catalog.getProduct("earbuds-anc"))?.stock).toBe(0);
  });

  it("gives stock back when an order lapses, and takes it again if it's paid late", async () => {
    await setStock("earbuds-anc", 3);
    const r = await checkout("earbuds-anc", 2);
    if (!r.ok) throw new Error(r.error.message);
    expect(await stockOf("earbuds-anc")).toBe(1);
    // Lapsed unpaid: both units go back on sale, once.
    expect(await app().ratings.releaseStock(r.value.orderId)).toBe(1);
    expect(await app().ratings.releaseStock(r.value.orderId)).toBe(0);
    expect(await stockOf("earbuds-anc")).toBe(3);
    // The money arrives late anyway: the sale takes the units again.
    await app().ratings.sales(r.value.orderId, [{ slug: "earbuds-anc", qty: 2 }]);
    expect(await stockOf("earbuds-anc")).toBe(1);
  });

  it("doesn't count a paid order's units twice", async () => {
    await setStock("earbuds-anc", 5);
    const r = await checkout("earbuds-anc", 2);
    if (!r.ok) throw new Error(r.error.message);
    await pay(r.value.invoiceId);
    await app().ratings.sales(r.value.orderId, [{ slug: "earbuds-anc", qty: 2 }]);
    await app().ratings.sales(r.value.orderId, [{ slug: "earbuds-anc", qty: 2 }]);
    expect(await stockOf("earbuds-anc")).toBe(3);
  });

  it("stops one sold-out option while the rest keep selling", async () => {
    await setStock("hoodie-heavyweight", null, ["M"]);
    expect(await checkout("hoodie-heavyweight", 1, "M · Ink")).toMatchObject({ ok: false, error: { code: "out_of_stock", message: expect.stringMatching(/in M is sold out/) } });
    expect((await checkout("hoodie-heavyweight", 1, "L · Ink")).ok).toBe(true);
    const view = await app().catalog.getProduct("hoodie-heavyweight");
    expect(view?.options?.[0].values.find((v) => v.label === "M")?.soldOut).toBe(true);
  });
});
