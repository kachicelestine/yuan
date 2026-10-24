import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { fixedClock } from "@/shared/kernel";
import { cents } from "@/shared/kernel/money";
import { makeCatalogQueries } from "../application/queries";
import { makeSearchProducts, makeSearchShops, type SearchCriteria } from "../application/search";
import { DrizzleProductSearch } from "./drizzle-product-search";
import { DrizzleCategoryRepository, DrizzleProductRepository, DrizzleSellerRepository } from "./drizzle-catalog-repositories";
import { seedCatalog } from "./seed";

describe("catalog on Postgres", () => {
  let db: Database;
  let q: ReturnType<typeof makeCatalogQueries>;

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedCatalog(db);
    q = makeCatalogQueries({
      categories: new DrizzleCategoryRepository(db),
      sellers: new DrizzleSellerRepository(db),
      products: new DrizzleProductRepository(db),
      clock: fixedClock("2026-10-23T12:00:00Z"),
    });
  });

  it("seeds the fixture catalog once, in order", async () => {
    expect((await q.listCategories())[0].id).toBe("energy");
    expect((await q.productSlugs()).length).toBeGreaterThan(40);
    expect(await seedCatalog(db)).toEqual({ skipped: true });
  });

  it("returns a product view the UI already understands", async () => {
    const p = await q.getProduct("solar-panel-450w-bifacial");
    expect(p).toMatchObject({ title: "450 W bifacial solar panel", category: "energy", sellerId: "sunvolt", delivery: "Nov 4–9" });
    expect(p!.price).toBeCloseTo(58, 2);
    expect(p!.tiers?.find((t) => t.min === 10)).toEqual({ min: 10, price: 52 });
    expect(await q.getProduct("does-not-exist")).toBeNull();
  });

  it("filters by category and seller, and finds similar items from other sellers", async () => {
    const energy = await q.listProducts({ category: "energy" });
    expect(energy.every((p) => p.category === "energy")).toBe(true);
    const sunvolt = await q.listProducts({ seller: "sunvolt" });
    expect(sunvolt.every((p) => p.sellerId === "sunvolt")).toBe(true);
    const similar = await q.similarProducts("solar-panel-450w-bifacial", 3);
    expect(similar.length).toBeGreaterThan(0);
    expect(similar.every((p) => p.category === "energy" && p.sellerId !== "sunvolt")).toBe(true);
  });

  it("loads a seller with its storefront", async () => {
    const page = await q.getSeller("sunvolt");
    expect(page?.seller.name).toBe("Sunvolt Energy");
    expect(page?.storefront?.exportsTo.length).toBeGreaterThan(0);
  });

  it("indexes titles and keywords for full-text search", async () => {
    const rows = await db.execute(sql`select slug from catalog.products where search @@ websearch_to_tsquery('english', 'solar panels') order by ts_rank(search, websearch_to_tsquery('english', 'solar panels')) desc`);
    const slugs = (rows as unknown as { rows?: { slug: string }[] }).rows ?? (rows as unknown as { slug: string }[]);
    expect(slugs.map((r) => r.slug)).toContain("solar-panel-450w-bifacial");
  });

  it("enforces listing rules in the database too", async () => {
    await expect(db.execute(sql`update catalog.products set min_order = 0 where slug = 'solar-panel-450w-bifacial'`)).rejects.toThrow();
  });

  describe("search", () => {
    const find = (c: Partial<SearchCriteria>) =>
      makeSearchProducts({ search: new DrizzleProductSearch(db), sellers: new DrizzleSellerRepository(db), clock: fixedClock("2026-10-23T12:00:00Z") })({ text: "", sort: "best", limit: 60, ...c });

    it("stems words, so plural queries find singular titles", async () => {
      const slugs = (await find({ text: "solar panels" })).map((p) => p.slug);
      expect(slugs[0]).toBe("solar-panel-450w-bifacial");
    });

    it("matches as you type", async () => {
      expect((await find({ text: "hood" })).map((p) => p.slug)).toContain("hoodie-heavyweight");
    });

    it("uses synonyms and matches seller and category names", async () => {
      expect((await find({ text: "dress" })).some((p) => p.slug.startsWith("qipao") || p.slug.startsWith("hanfu"))).toBe(true);
      expect((await find({ text: "sunvolt" })).every((p) => p.sellerId === "sunvolt")).toBe(true);
    });

    it("filters by price, category, sale and delivery speed", async () => {
      const cheap = await find({ maxPrice: cents(2000) });
      expect(cheap.length).toBeGreaterThan(0);
      expect(cheap.every((p) => p.price !== undefined && p.price <= 20)).toBe(true);
      expect((await find({ categories: ["beauty"] })).every((p) => p.category === "beauty")).toBe(true);
      expect((await find({ onSale: true })).every((p) => p.was !== undefined)).toBe(true);
      expect((await find({ fast: true })).every((p) => p.leadTime.minDays <= 10)).toBe(true);
    });

    it("sorts by price with quote-only items last", async () => {
      const list = await find({ sort: "price-asc" });
      const priced = list.filter((p) => p.price !== undefined).map((p) => p.price!);
      expect(priced).toEqual([...priced].sort((a, b) => a - b));
      expect(list.at(-1)?.price).toBeUndefined();
    });

    it("carries the seller summary for cards", async () => {
      const [first] = await find({ text: "earbuds" });
      expect(first.seller?.name).toBeTruthy();
    });
  });

  describe("shop search", () => {
    const shops = (text: string) => makeSearchShops({ search: new DrizzleProductSearch(db) })(text, 20);

    it("puts a shop named like the search first, with photos of what it sells", async () => {
      const [first] = await shops("sunvolt");
      expect(first.id).toBe("sunvolt");
      expect(first.preview.length).toBeGreaterThan(0);
      expect(first.preview.length).toBeLessThanOrEqual(3);
    });

    it("finds shops through the listings that match, most matches first", async () => {
      const found = await shops("solar");
      expect(found.length).toBeGreaterThan(0);
      expect(found.every((s) => s.matching > 0 || s.name.toLowerCase().includes("sol"))).toBe(true);
      const counts = found.filter((s) => s.matching > 0).map((s) => s.matching);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });

    it("finds nothing for stopwords or an empty search", async () => {
      expect(await shops("")).toEqual([]);
      expect(await shops("the best")).toEqual([]);
    });
  });
});
