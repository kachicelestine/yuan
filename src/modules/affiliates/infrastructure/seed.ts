import { count } from "drizzle-orm";
import { sampleOffers as sampleFixtures } from "@/fixtures/account";
import { products as productFixtures } from "@/fixtures/products";
import type { Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { sampleOffers } from "./schema";

/** The design-phase sample offers, from the shops that sell those products. */
export async function seedAffiliates(db: Database, now = new Date()) {
  const [{ value: have }] = await db.select({ value: count() }).from(sampleOffers);
  if (have > 0) return { skipped: true };
  const rows = sampleFixtures.flatMap((slug) => {
    const p = productFixtures.find((x) => x.slug === slug);
    return p ? [{ id: newId(), sellerId: p.sellerId, slug, remaining: 20, active: true, createdAt: now }] : [];
  });
  if (rows.length) await db.insert(sampleOffers).values(rows);
  return { skipped: false, sampleOffers: rows.length };
}
