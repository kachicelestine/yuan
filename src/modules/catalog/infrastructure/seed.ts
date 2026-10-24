import { count } from "drizzle-orm";
import { categories as categoryFixtures } from "@/fixtures/categories";
import { products as productFixtures } from "@/fixtures/products";
import { profiles } from "@/fixtures/profiles";
import { sellers as sellerFixtures } from "@/fixtures/sellers";
import type { Database } from "@/shared/infrastructure/database";
import { expectOk, money, newId } from "@/shared/kernel";
import type { CategoryId } from "../domain/category";
import { createProduct, type LeadTime } from "../domain/product";
import type { SellerId } from "../domain/seller";
import { toProductRow } from "./drizzle-catalog-repositories";
import { categories, products, sellers } from "./schema";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The design fixtures' delivery windows were written on this date. */
const FIXTURE_DAY = Date.UTC(2026, 9, 23);

/** Turns a fixture window ("Nov 4–9", "Oct 30–Nov 3", "6–8 weeks") into days from order. */
export function leadTimeFrom(window: string): LeadTime {
  const weeks = /^(\d+)–(\d+) weeks$/.exec(window);
  if (weeks) return { minDays: Number(weeks[1]) * 7, maxDays: Number(weeks[2]) * 7 };
  const m = /^([A-Z][a-z]{2}) (\d+)–(?:([A-Z][a-z]{2}) )?(\d+)$/.exec(window);
  if (!m) throw new Error(`Unrecognised delivery window "${window}"`);
  const day = (month: string, d: string) => Math.round((Date.UTC(2026, MONTHS.indexOf(month), Number(d)) - FIXTURE_DAY) / 86_400_000);
  return { minDays: day(m[1], m[2]), maxDays: day(m[3] ?? m[1], m[4]) };
}

/** Loads the design-phase catalog. Skips when categories already exist. */
export async function seedCatalog(db: Database) {
  const [{ value }] = await db.select({ value: count() }).from(categories);
  if (value > 0) return { skipped: true };

  const items = productFixtures.map((f, i) =>
    expectOk(
      createProduct({
        // Spaced a millisecond apart so UUIDv7 order matches the fixture order.
        id: newId(Date.UTC(2026, 0, 1) + i),
        slug: f.slug,
        title: f.title,
        categoryId: f.category as CategoryId,
        sellerId: f.sellerId as SellerId,
        images: f.images,
        price: f.price === undefined ? null : money.fromDollars(f.price),
        was: f.was === undefined ? null : money.fromDollars(f.was),
        tiers: (f.tiers ?? []).map((t) => ({ minQty: t.min, price: money.fromDollars(t.price) })),
        minOrder: f.moq ?? 1,
        rating: f.rating,
        reviewCount: f.reviews,
        soldCount: f.sold ?? null,
        options: (f.options ?? []).map((o) => ({
          name: o.name,
          defaultIndex: o.defaultIndex ?? 0,
          values: o.values.map((v) => ({ label: v.label, sub: v.sub ?? null, delta: money.fromDollars(v.delta ?? 0), swatch: v.swatch ?? null })),
        })),
        highlights: f.highlights,
        specs: f.specs,
        buyersSay: f.buyersSay ?? null,
        shipsFrom: f.shipsFrom,
        leadTime: leadTimeFrom(f.delivery),
        dutyRate: f.dutyRate,
      }),
      `fixture product ${f.slug}`,
    ),
  );

  await db.transaction(async (tx) => {
    await tx.insert(categories).values(categoryFixtures.map((c, position) => ({ ...c, position })));
    await tx.insert(sellers).values(
      Object.values(sellerFixtures).map((s) => {
        const p = profiles[s.id];
        return {
          id: s.id,
          name: s.name,
          kind: s.kind,
          city: s.city,
          avatar: s.avatar,
          verified: s.verified,
          audited: s.audited ?? null,
          yearsInBusiness: s.years ?? null,
          storefront: p
            ? {
                cover: p.cover,
                bio: p.bio,
                followers: p.followers,
                rating: p.rating,
                responseHours: p.responseHours,
                onTimeRate: p.onTime,
                certificates: p.certificates,
                capacity: p.capacity ?? null,
                staff: p.staff ?? null,
                floorArea: p.floorArea ?? null,
                exportsTo: p.exportsTo,
              }
            : null,
        };
      }),
    );
    await tx.insert(products).values(items.map(toProductRow));
  });
  return { skipped: false, products: items.length };
}
