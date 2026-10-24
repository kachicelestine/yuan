import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { categories, products, sellers } from "@/modules/catalog/infrastructure/schema";
import { photo } from "@/lib/images";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { seedAll } from "./seed";

const PREFIX = "https://images.unsplash.com/";
const SUFFIX = "&w=1200&fm=jpg&q=80";

describe("migrations 0005–0006: image keys become full URLs", () => {
  let db: Database;

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
  });

  it("builds URLs capped at 1200 px", () => {
    expect(photo("123", { ar: "1:1", fx: 0.5, fy: 0.3 })).toBe(`${PREFIX}photo-123?ar=1%3A1&fit=crop&crop=focalpoint&fp-x=0.5&fp-y=0.3${SUFFIX}`);
  });

  it("turns the old keys back into exactly what photo() builds", async () => {
    const snapshot = async () => ({
      categories: (await db.select({ image: categories.image, hero: categories.hero }).from(categories).orderBy(categories.id)),
      sellers: (await db.select({ avatar: sellers.avatar, cover: sql<string>`${sellers.storefront}->>'cover'` }).from(sellers).orderBy(sellers.id)),
      products: (await db.select({ v: products.images }).from(products).orderBy(products.id)).map((r) => r.v),
    });
    const seeded = await snapshot();
    const urls = [...seeded.products.flat(), ...seeded.categories.flatMap((c) => [c.image, c.hero]), ...seeded.sellers.flatMap((s) => [s.avatar, s.cover ?? `${PREFIX}${SUFFIX}`])];
    expect(urls.every((u) => u.startsWith(PREFIX) && u.endsWith(SUFFIX))).toBe(true);

    // Put the rows back the way the previous release stored them.
    const toKey = (column: ReturnType<typeof sql>) => sql`replace(replace(${column}, ${PREFIX}, ''), ${SUFFIX}, '')`;
    await db.execute(sql`update catalog.categories set image = ${toKey(sql`image`)}, hero = ${toKey(sql`hero`)}`);
    await db.execute(sql`update catalog.sellers set avatar = ${toKey(sql`avatar`)}`);
    await db.execute(sql`update catalog.sellers set storefront = jsonb_set(storefront, '{cover}', to_jsonb(${toKey(sql`storefront->>'cover'`)})) where storefront ? 'cover'`);
    await db.execute(sql`update catalog.products set images = array(select ${toKey(sql`k`)} from unnest(images) with ordinality as t(k, n) order by n)`);
    expect((await snapshot()).products.flat().every((k) => k.startsWith("photo-"))).toBe(true);

    for (const file of ["drizzle/0005_absolute_image_urls.sql", "drizzle/0006_hero_and_cover_urls.sql"]) {
      for (const statement of readFileSync(file, "utf8").split("--> statement-breakpoint")) await db.execute(sql.raw(statement));
    }
    expect(await snapshot()).toEqual(seeded);
  });
});
