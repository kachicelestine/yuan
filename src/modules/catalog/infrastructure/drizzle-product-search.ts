import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql, type SQL } from "drizzle-orm";
import { synonyms as defaultSynonyms } from "@/fixtures/search";
import type { Database } from "@/shared/infrastructure/database";
import { FAST_DAYS, type ProductSearch, type ProductSort, type SearchCriteria, type ShopHit, type ShopSearch } from "../application/search";
import { toProduct, toSeller } from "./drizzle-catalog-repositories";
import { categories, products, sellers } from "./schema";
import { toTsQuery } from "@/shared/infrastructure/ts-query";

/**
 * Full-text product search in Postgres. Matches the product's own vector (title, then
 * highlights, specs and options) plus its category and seller, so "jade" finds the
 * jade studio's items and "factory towns" words like "Yiwu" work too.
 */
export class DrizzleProductSearch implements ProductSearch, ShopSearch {
  constructor(
    private readonly db: Database,
    private readonly synonyms: Readonly<Record<string, readonly string[]>> = defaultSynonyms,
  ) {}

  async search(c: SearchCriteria) {
    const tsq = toTsQuery(c.text, this.synonyms);
    const query = tsq ? sql`to_tsquery('english', ${tsq})` : null;
    const doc = sql`(${products.search} || to_tsvector('english', ${categories.label} || ' ' || ${sellers.name} || ' ' || ${sellers.city}))`;

    const where: SQL[] = [eq(products.status, "active")];
    if (query) where.push(sql`${doc} @@ ${query}`);
    if (c.minPrice !== undefined) where.push(gte(products.priceCents, c.minPrice));
    if (c.maxPrice !== undefined) where.push(lte(products.priceCents, c.maxPrice));
    if (c.categories?.length) where.push(inArray(products.categoryId, c.categories));
    if (c.minRating) where.push(gte(products.rating, c.minRating));
    if (c.sellerKinds?.length) where.push(inArray(sellers.kind, c.sellerKinds));
    if (c.onSale) where.push(isNotNull(products.wasCents));
    if (c.bulk) where.push(sql`jsonb_array_length(${products.tiers}) > 0`);
    if (c.fast) where.push(lte(products.leadMinDays, FAST_DAYS));
    if (c.verified) where.push(isNotNull(sellers.audited));

    const popularity = sql`coalesce(${products.soldCount}, ${products.reviewCount})`;
    const order: Record<ProductSort, SQL[]> = {
      // With no text there's nothing to rank by relevance (and a bare 0 would mean "column 0").
      best: query ? [desc(sql`ts_rank(${doc}, ${query})`), desc(popularity)] : [desc(popularity)],
      "price-asc": [sql`${products.priceCents} asc nulls last`],
      "price-desc": [sql`${products.priceCents} desc nulls last`],
      rating: [desc(products.rating), desc(products.reviewCount)],
      sold: [desc(popularity)],
    };

    const rows = await this.db
      .select({ product: products })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(sellers, eq(products.sellerId, sellers.id))
      .where(and(...where))
      .orderBy(...order[c.sort], asc(products.id))
      .limit(c.limit);
    return rows.map((r) => toProduct(r.product));
  }

  async shops(text: string, limit: number): Promise<ShopHit[]> {
    const tsq = toTsQuery(text, this.synonyms);
    if (!tsq) return [];
    const query = sql`to_tsquery('english', ${tsq})`;
    // A shop matches by its own words, or through its live listings that match.
    const own = sql`to_tsvector('english', ${sellers.name} || ' ' || ${sellers.city} || ' ' || ${sellers.kind} || ' ' || coalesce(${sellers.storefront}->>'bio', ''))`;
    const hits = this.db.$with("hits").as(
      this.db
        .select({
          sellerId: products.sellerId,
          matching: sql<number>`count(*)::int`.as("matching"),
          preview: sql<string[]>`(array_agg(${products.images}[1] order by coalesce(${products.soldCount}, ${products.reviewCount}) desc))[1:3]`.as("preview"),
        })
        .from(products)
        .where(and(eq(products.status, "active"), sql`${products.search} @@ ${query}`))
        .groupBy(products.sellerId),
    );
    const named = sql<boolean>`${own} @@ ${query}`;
    const rows = await this.db
      .with(hits)
      .select({ seller: sellers, matching: hits.matching, preview: hits.preview, named })
      .from(sellers)
      .leftJoin(hits, eq(hits.sellerId, sellers.id))
      .where(sql`(${named} or ${hits.matching} > 0)`)
      .orderBy(desc(named), sql`${hits.matching} desc nulls last`, desc(sql`coalesce((${sellers.storefront}->>'rating')::numeric, 0)`), asc(sellers.id))
      .limit(limit);
    const previews = await this.previewsFor(rows.filter((r) => !r.preview?.length).map((r) => r.seller.id));
    return rows.map((r) => ({ seller: toSeller(r.seller), matching: r.matching ?? 0, preview: r.preview?.length ? r.preview : (previews.get(r.seller.id) ?? []) }));
  }

  /** Best-selling photos for shops found by name alone. */
  private async previewsFor(sellerIds: string[]) {
    if (!sellerIds.length) return new Map<string, string[]>();
    const rows = await this.db
      .select({
        sellerId: products.sellerId,
        preview: sql<string[]>`(array_agg(${products.images}[1] order by coalesce(${products.soldCount}, ${products.reviewCount}) desc))[1:3]`,
      })
      .from(products)
      .where(and(eq(products.status, "active"), inArray(products.sellerId, sellerIds)))
      .groupBy(products.sellerId);
    return new Map(rows.map((r) => [r.sellerId, r.preview ?? []]));
  }
}
