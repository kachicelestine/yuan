import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

// Price history is what we recorded, day by day; watches alert once when the price
// reaches the target (and again only if it drops further), optionally into the bag.
describe("price history and price alerts", () => {
  let db: Database;
  let now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network: new SimulatedNetwork(db), simulator: null } });
  const setPrice = (slug: string, dollars: number) => db.execute(sql`update catalog.products set price_cents = ${money.fromDollars(dollars)} where slug = ${slug}`);

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
  });

  it("records one price per listing per day, the day's last one winning", async () => {
    expect(await app().catalog.priceHistory("hoodie-heavyweight")).toEqual([]);
    await app().catalog.recordPrices();
    await setPrice("hoodie-heavyweight", 30);
    await app().catalog.recordPrices();
    now = new Date(now.getTime() + 86_400_000);
    await setPrice("hoodie-heavyweight", 28);
    await app().catalog.recordPrices();
    expect(await app().catalog.priceHistory("hoodie-heavyweight")).toEqual([
      { date: "2026-10-24", price: 30 },
      { date: "2026-10-25", price: 28 },
    ]);
  });

  it("alerts a watch once at the target, again on a further drop, and can put it in the bag", async () => {
    const shopper = newId();
    await app().engagement.replaceLists(shopper, { saved: [], alerts: [], watches: [{ slug: "hoodie-heavyweight", target: 27, autoBuy: true }] });
    const prices = (slugs: readonly string[]) => app().catalog.currentPrices(slugs);
    expect(await app().engagement.dueWatches(prices)).toEqual([]); // $28 is above $27

    await setPrice("hoodie-heavyweight", 26.5);
    expect(await app().engagement.dueWatches(prices)).toEqual([{ accountId: shopper, slug: "hoodie-heavyweight", price: 26.5, target: 27, addToBag: true }]);
    expect(await app().engagement.dueWatches(prices)).toEqual([]); // same price: told already
    // Re-saving the same watch from a device keeps that memory.
    await app().engagement.replaceLists(shopper, { saved: [], alerts: [], watches: [{ slug: "hoodie-heavyweight", target: 27, autoBuy: true }] });
    expect(await app().engagement.dueWatches(prices)).toEqual([]);

    await setPrice("hoodie-heavyweight", 25);
    expect((await app().engagement.dueWatches(prices)).map((w) => w.price)).toEqual([25]);
  });
});
