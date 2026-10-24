import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { Category, CategoryId } from "../domain/category";
import type { Product } from "../domain/product";
import type { CategoryRepository, ProductRepository, SellerRepository } from "../domain/repositories";
import type { Seller, SellerId } from "../domain/seller";
import { categories, products, sellers, type StoredOption } from "./schema";

const toCategory = (r: typeof categories.$inferSelect): Category => ({ ...r, id: r.id as CategoryId });

const toSeller = (r: typeof sellers.$inferSelect): Seller => ({
  id: r.id as SellerId,
  name: r.name,
  kind: r.kind,
  city: r.city,
  avatar: r.avatar,
  verified: r.verified,
  audited: r.audited,
  yearsInBusiness: r.yearsInBusiness,
  storefront: r.storefront,
});

export function toProduct(r: typeof products.$inferSelect): Product {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    categoryId: r.categoryId as CategoryId,
    sellerId: r.sellerId as SellerId,
    status: r.status,
    images: r.images,
    price: r.priceCents === null ? null : cents(r.priceCents),
    was: r.wasCents === null ? null : cents(r.wasCents),
    tiers: r.tiers.map((t) => ({ minQty: t.minQty, price: cents(t.priceCents) })),
    minOrder: r.minOrder,
    rating: r.rating,
    reviewCount: r.reviewCount,
    soldCount: r.soldCount,
    options: r.options.map((o) => ({ ...o, values: o.values.map(({ deltaCents, ...v }) => ({ ...v, delta: cents(deltaCents) })) })),
    highlights: r.highlights,
    specs: r.specs,
    buyersSay: r.buyersSay,
    shipsFrom: r.shipsFrom,
    leadTime: { minDays: r.leadMinDays, maxDays: r.leadMaxDays },
    dutyRate: r.dutyRate,
  };
}

/** Words a buyer might search that aren't in the title. */
const keywordsOf = (p: Product) => [...p.highlights, ...p.specs.flat(), ...p.options.flatMap((o) => [o.name, ...o.values.map((v) => v.label)]), p.shipsFrom].join(" ");

export function toProductRow(p: Product): typeof products.$inferInsert {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    categoryId: p.categoryId,
    sellerId: p.sellerId,
    status: p.status,
    images: [...p.images],
    priceCents: p.price,
    wasCents: p.was,
    tiers: p.tiers.map((t) => ({ minQty: t.minQty, priceCents: t.price })),
    minOrder: p.minOrder,
    rating: p.rating,
    reviewCount: p.reviewCount,
    soldCount: p.soldCount,
    options: p.options.map((o): StoredOption => ({ ...o, values: o.values.map(({ delta, ...v }) => ({ ...v, deltaCents: delta })) })),
    highlights: [...p.highlights],
    specs: p.specs.map(([k, v]) => [k, v]),
    buyersSay: p.buyersSay,
    shipsFrom: p.shipsFrom,
    leadMinDays: p.leadTime.minDays,
    leadMaxDays: p.leadTime.maxDays,
    dutyRate: p.dutyRate,
    keywords: keywordsOf(p),
  };
}

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Database) {}

  async list() {
    return (await this.db.select().from(categories).orderBy(asc(categories.position))).map(toCategory);
  }

  async findById(id: CategoryId) {
    const [r] = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return r ? toCategory(r) : null;
  }
}

export class DrizzleSellerRepository implements SellerRepository {
  constructor(private readonly db: Database) {}

  async list() {
    return (await this.db.select().from(sellers).orderBy(asc(sellers.createdAt), asc(sellers.id))).map(toSeller);
  }

  async findById(id: SellerId) {
    const [r] = await this.db.select().from(sellers).where(eq(sellers.id, id)).limit(1);
    return r ? toSeller(r) : null;
  }

  async findByIds(ids: readonly SellerId[]) {
    if (!ids.length) return [];
    return (await this.db.select().from(sellers).where(inArray(sellers.id, [...ids]))).map(toSeller);
  }
}

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly db: Database) {}

  async findBySlug(slug: string) {
    const [r] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.status, "active")))
      .limit(1);
    return r ? toProduct(r) : null;
  }

  async list(filter: { categoryId?: CategoryId; sellerId?: SellerId; limit?: number } = {}) {
    const where: SQL[] = [eq(products.status, "active")];
    if (filter.categoryId) where.push(eq(products.categoryId, filter.categoryId));
    if (filter.sellerId) where.push(eq(products.sellerId, filter.sellerId));
    // UUIDv7 ids sort by creation time, so this is "oldest listing first".
    const query = this.db.select().from(products).where(and(...where)).orderBy(asc(products.id));
    return (filter.limit ? await query.limit(filter.limit) : await query).map(toProduct);
  }

  async slugs() {
    return (await this.db.select({ slug: products.slug }).from(products).where(eq(products.status, "active"))).map((r) => r.slug);
  }

  async save(p: Product) {
    const row = toProductRow(p);
    await this.db
      .insert(products)
      .values(row)
      .onConflictDoUpdate({ target: products.id, set: { ...row, updatedAt: new Date() } });
  }
}
