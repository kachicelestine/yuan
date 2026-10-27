import { and, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, or, sql, sum, type SQL } from "drizzle-orm";
import { campaigns, daily as adDaily } from "@/modules/ads/infrastructure/schema";
import { products, sellers } from "@/modules/catalog/infrastructure/schema";
import { reports, videos, videoStats } from "@/modules/content/infrastructure/schema";
import { accounts } from "@/modules/identity/infrastructure/schema";
import { shows } from "@/modules/live/infrastructure/schema";
import { applications, members } from "@/modules/merchants/infrastructure/schema";
import { orders, shipments } from "@/modules/ordering/infrastructure/schema";
import { disbursements, ledgerEntries } from "@/modules/payments/infrastructure/schema";
import type { Database } from "@/shared/infrastructure/database";

// The admin read model: plain queries across every context, for people running the
// platform. Nothing here changes data; decisions go through each module's use cases.

const PAGE = 50;
const DAY = 86_400_000;

/** A search term made safe for ILIKE. */
const pattern = (q: string) => `%${q.trim().slice(0, 80).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const dollars = (cents: number | string | null | undefined) => Number(cents ?? 0) / 100;
const iso = (d: Date | null) => d?.toISOString() ?? null;
/** A credit balance as a positive amount (and never -0). */
const credit = (cents: number | string | null | undefined) => -dollars(cents) || 0;

export type AdminOverview = {
  accounts: number;
  newAccounts: number;
  suspendedAccounts: number;
  shops: number;
  suspendedShops: number;
  liveListings: number;
  removedListings: number;
  paidOrders: number;
  /** Dollars paid in the last 30 days. */
  gmv: number;
  inEscrow: number;
  commission: number;
  adRevenue: number;
  openDisputes: number;
  waiting: { applications: number; videos: number; reports: number; transfers: number };
  liveNow: number;
  runningCampaigns: number;
};

export async function overview(db: Database, now: Date): Promise<AdminOverview> {
  const month = new Date(now.getTime() - 30 * DAY);
  const week = new Date(now.getTime() - 7 * DAY);
  const [acc, shop, listing, paid, ledger, disputes, apps, vids, reps, transfers, live, ads] = await Promise.all([
    db
      .select({ all: count(), fresh: sql<number>`count(*) filter (where ${accounts.createdAt} >= ${week.toISOString()}::timestamptz)::int`, suspended: count(accounts.suspendedAt) })
      .from(accounts),
    db.select({ all: count(), suspended: count(sellers.suspendedAt) }).from(sellers),
    db
      .select({ live: sql<number>`count(*) filter (where ${products.status} = 'active')::int`, removed: sql<number>`count(*) filter (where ${products.status} = 'removed')::int` })
      .from(products),
    db
      .select({ n: count(), total: sum(orders.totalCents) })
      .from(orders)
      .where(and(isNotNull(orders.paidAt), gte(orders.paidAt, month))),
    db
      .select({
        escrow: sql<string>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.account} like 'escrow:%'), 0)`,
        commission: sql<string>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.account} = 'platform:commission'), 0)`,
        ads: sql<string>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.account} = 'platform:ads'), 0)`,
      })
      .from(ledgerEntries),
    db.select({ n: count() }).from(shipments).where(eq(shipments.status, "disputed")),
    db.select({ n: count() }).from(applications).where(eq(applications.status, "submitted")),
    db.select({ n: count() }).from(videos).where(eq(videos.status, "review")),
    db.select({ n: sql<number>`count(distinct (${reports.targetType}, ${reports.targetId}))::int` }).from(reports).where(eq(reports.status, "open")),
    db.select({ n: count() }).from(disbursements).where(eq(disbursements.status, "requested")),
    db.select({ n: count() }).from(shows).where(eq(shows.status, "live")),
    db.select({ n: count() }).from(campaigns).where(eq(campaigns.status, "active")),
  ]);
  return {
    accounts: acc[0].all,
    newAccounts: acc[0].fresh,
    suspendedAccounts: acc[0].suspended,
    shops: shop[0].all,
    suspendedShops: shop[0].suspended,
    liveListings: listing[0].live,
    removedListings: listing[0].removed,
    paidOrders: paid[0].n,
    gmv: dollars(paid[0].total),
    // Escrow, commission and ad revenue are credits in the ledger (negative balances).
    inEscrow: credit(ledger[0].escrow),
    commission: credit(ledger[0].commission),
    adRevenue: credit(ledger[0].ads),
    openDisputes: disputes[0].n,
    waiting: { applications: apps[0].n, videos: vids[0].n, reports: reps[0].n, transfers: transfers[0].n },
    liveNow: live[0].n,
    runningCampaigns: ads[0].n,
  };
}

export type AdminUserView = {
  id: string;
  email: string | null;
  wallet: string | null;
  joinedAt: string;
  suspendedAt: string | null;
  suspendReason: string | null;
  orders: number;
  spent: number;
  shops: string[];
};

export async function users(db: Database, q = ""): Promise<AdminUserView[]> {
  const term = q.trim();
  const where: SQL | undefined = term ? (/^[0-9a-f-]{36}$/i.test(term) ? eq(accounts.id, term) : or(ilike(accounts.email, pattern(term)), ilike(accounts.wallet, pattern(term)))) : undefined;
  const rows = await db.select().from(accounts).where(where).orderBy(desc(accounts.createdAt)).limit(PAGE);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [bought, shops] = await Promise.all([
    db
      .select({ id: orders.buyerId, n: count(), spent: sum(orders.totalCents) })
      .from(orders)
      .where(and(inArray(orders.buyerId, ids), isNotNull(orders.paidAt)))
      .groupBy(orders.buyerId),
    db.select({ id: members.accountId, sellerId: members.sellerId }).from(members).where(inArray(members.accountId, ids)),
  ]);
  const byBuyer = new Map(bought.map((b) => [b.id, b]));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    wallet: r.wallet,
    joinedAt: r.createdAt.toISOString(),
    suspendedAt: iso(r.suspendedAt),
    suspendReason: r.suspendReason,
    orders: byBuyer.get(r.id)?.n ?? 0,
    spent: dollars(byBuyer.get(r.id)?.spent),
    shops: shops.filter((s) => s.id === r.id).map((s) => s.sellerId),
  }));
}

export type AdminShopView = {
  id: string;
  name: string;
  kind: string;
  city: string;
  avatar: string;
  verified: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  listings: number;
  /** Dollars in parcels over the last 30 days. */
  sales: number;
  openDisputes: number;
  balance: number;
};

export async function shops(db: Database, now: Date, q = ""): Promise<AdminShopView[]> {
  const term = q.trim();
  const rows = await db
    .select()
    .from(sellers)
    .where(term ? or(ilike(sellers.name, pattern(term)), ilike(sellers.id, pattern(term)), ilike(sellers.city, pattern(term))) : undefined)
    .orderBy(desc(sellers.createdAt))
    .limit(PAGE);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const month = new Date(now.getTime() - 30 * DAY);
  const [listed, parcels, balances] = await Promise.all([
    db
      .select({ id: products.sellerId, n: count() })
      .from(products)
      .where(and(inArray(products.sellerId, ids), eq(products.status, "active")))
      .groupBy(products.sellerId),
    db
      .select({
        id: shipments.sellerId,
        sales: sql<string>`coalesce(sum(${shipments.amountCents}) filter (where ${orders.paidAt} >= ${month.toISOString()}::timestamptz), 0)`,
        disputes: sql<number>`count(*) filter (where ${shipments.status} = 'disputed')::int`,
      })
      .from(shipments)
      .innerJoin(orders, eq(orders.id, shipments.orderId))
      .where(inArray(shipments.sellerId, ids))
      .groupBy(shipments.sellerId),
    db
      .select({ account: ledgerEntries.account, total: sum(ledgerEntries.amountCents) })
      .from(ledgerEntries)
      .where(
        inArray(
          ledgerEntries.account,
          ids.map((id) => `seller:${id}`),
        ),
      )
      .groupBy(ledgerEntries.account),
  ]);
  const n = new Map(listed.map((l) => [l.id, l.n]));
  const p = new Map(parcels.map((x) => [x.id, x]));
  const b = new Map(balances.map((x) => [x.account, x.total]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    city: r.city,
    avatar: r.avatar,
    verified: r.verified,
    suspendedAt: iso(r.suspendedAt),
    suspendReason: r.suspendReason,
    listings: n.get(r.id) ?? 0,
    sales: dollars(p.get(r.id)?.sales),
    openDisputes: p.get(r.id)?.disputes ?? 0,
    // Seller balances are credits: what the platform owes them.
    balance: credit(b.get(`seller:${r.id}`)),
  }));
}

export type AdminListingView = {
  id: string;
  slug: string;
  title: string;
  image: string | null;
  sellerId: string;
  sellerName: string;
  status: string;
  price: number | null;
  sold: number;
  moderationNote: string | null;
  updatedAt: string;
};

export const LISTING_FILTERS = ["all", "active", "draft", "removed", "suspended", "archived"] as const;
export type ListingFilter = (typeof LISTING_FILTERS)[number];

export async function listings(db: Database, q = "", status: ListingFilter = "all"): Promise<AdminListingView[]> {
  const term = q.trim();
  const rows = await db
    .select({ p: products, sellerName: sellers.name })
    .from(products)
    .innerJoin(sellers, eq(sellers.id, products.sellerId))
    .where(
      and(
        status === "all" ? undefined : eq(products.status, status),
        term ? or(ilike(products.title, pattern(term)), ilike(products.slug, pattern(term)), ilike(products.sellerId, pattern(term))) : undefined,
      ),
    )
    .orderBy(desc(products.updatedAt))
    .limit(PAGE);
  return rows.map(({ p, sellerName }) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    image: p.images[0] ?? null,
    sellerId: p.sellerId,
    sellerName,
    status: p.status,
    price: p.priceCents === null ? null : dollars(p.priceCents),
    sold: p.soldCount ?? 0,
    moderationNote: p.moderationNote,
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export type AdminParcelView = { sellerId: string; status: string; amount: number; tracking: string | null; disputeReason: string | null; resolution: string | null };
export type AdminOrderView = {
  id: string;
  number: string;
  kind: string;
  buyerId: string;
  buyerEmail: string | null;
  status: string;
  country: string;
  total: number;
  discount: number;
  couponId: string | null;
  placedAt: string;
  paidAt: string | null;
  parcels: AdminParcelView[];
};

export const ORDER_FILTERS = ["all", "unpaid", "paid", "disputed"] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

export async function orderList(db: Database, q = "", filter: OrderFilter = "all"): Promise<AdminOrderView[]> {
  const term = q.trim();
  const search = term ? or(ilike(orders.number, pattern(term)), ilike(accounts.email, pattern(term)), /^[0-9a-f-]{36}$/i.test(term) ? or(eq(orders.id, term), eq(orders.buyerId, term)) : undefined) : undefined;
  const status =
    filter === "unpaid"
      ? isNull(orders.paidAt)
      : filter === "paid"
        ? isNotNull(orders.paidAt)
        : filter === "disputed"
          ? sql`exists (select 1 from ${shipments} where ${shipments.orderId} = ${orders.id} and ${shipments.status} = 'disputed')`
          : undefined;
  const rows = await db
    .select({ o: orders, email: accounts.email })
    .from(orders)
    .leftJoin(accounts, eq(accounts.id, orders.buyerId))
    .where(and(search, status))
    .orderBy(desc(orders.placedAt))
    .limit(PAGE);
  if (!rows.length) return [];
  const parcels = await db
    .select()
    .from(shipments)
    .where(
      inArray(
        shipments.orderId,
        rows.map((r) => r.o.id),
      ),
    );
  return rows.map(({ o, email }) => ({
    id: o.id,
    number: o.number,
    kind: o.kind,
    buyerId: o.buyerId,
    buyerEmail: email,
    status: o.status,
    country: o.country,
    total: dollars(o.totalCents),
    discount: dollars(o.discountCents),
    couponId: o.couponId,
    placedAt: o.placedAt.toISOString(),
    paidAt: iso(o.paidAt),
    parcels: parcels
      .filter((s) => s.orderId === o.id)
      .map((s) => ({ sellerId: s.sellerId, status: s.status, amount: dollars(s.amountCents), tracking: s.tracking, disputeReason: s.disputeReason, resolution: s.resolution })),
  }));
}

export type AdminVideoView = { id: string; caption: string; poster: string; sellerId: string; productSlug: string; status: string; views: number; likes: number; createdAt: string; uploaded: boolean };

export async function videoList(db: Database, q = ""): Promise<AdminVideoView[]> {
  const term = q.trim();
  const rows = await db
    .select({ v: videos, views: videoStats.views, likes: videoStats.likes })
    .from(videos)
    .leftJoin(videoStats, eq(videoStats.videoId, videos.id))
    .where(term ? or(ilike(videos.caption, pattern(term)), ilike(videos.sellerId, pattern(term)), ilike(videos.productSlug, pattern(term))) : undefined)
    .orderBy(desc(videos.createdAt))
    .limit(PAGE);
  return rows.map(({ v, views, likes }) => ({
    id: v.id,
    caption: v.caption,
    poster: v.posterUrl,
    sellerId: v.sellerId,
    productSlug: v.productSlug,
    status: v.status,
    views: views ?? 0,
    likes: likes ?? 0,
    createdAt: v.createdAt.toISOString(),
    uploaded: v.authorId !== null,
  }));
}

export type AdminShowView = { id: string; title: string; sellerId: string; hostName: string; status: string; scheduledFor: string; startedAt: string | null; peakViewers: number; cover: string };

export async function showList(db: Database): Promise<AdminShowView[]> {
  const rows = await db
    .select()
    .from(shows)
    .orderBy(sql`case ${shows.status} when 'live' then 0 when 'scheduled' then 1 else 2 end`, desc(shows.scheduledFor))
    .limit(PAGE);
  return rows.map((s) => ({
    id: s.id,
    title: s.title,
    sellerId: s.sellerId,
    hostName: s.hostName,
    status: s.status,
    scheduledFor: s.scheduledFor.toISOString(),
    startedAt: iso(s.startedAt),
    peakViewers: s.peakViewers,
    cover: s.coverUrl,
  }));
}

export type AdminCampaignView = { id: string; sellerId: string; name: string; status: string; bid: number; dailyBudget: number; items: number; spend7d: number; clicks7d: number; impressions7d: number };

export async function campaignList(db: Database, now: Date): Promise<AdminCampaignView[]> {
  const week = new Date(now.getTime() - 7 * DAY).toISOString().slice(0, 10);
  const rows = await db
    .select({
      c: campaigns,
      spend: sql<string>`coalesce(sum(${adDaily.spendCents}), 0)`,
      clicks: sql<number>`coalesce(sum(${adDaily.clicks}), 0)::int`,
      impressions: sql<number>`coalesce(sum(${adDaily.impressions}), 0)::int`,
    })
    .from(campaigns)
    .leftJoin(adDaily, and(eq(adDaily.campaignId, campaigns.id), gte(adDaily.day, week)))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.updatedAt))
    .limit(PAGE);
  return rows.map(({ c, spend, clicks, impressions }) => ({
    id: c.id,
    sellerId: c.sellerId,
    name: c.name,
    status: c.status,
    bid: dollars(c.bidCents),
    dailyBudget: dollars(c.dailyBudgetCents),
    items: c.slugs.length,
    spend7d: dollars(spend),
    clicks7d: clicks,
    impressions7d: impressions,
  }));
}

export type LedgerLine = { account: string; label: string; balance: number };

const PLATFORM_LABELS: Record<string, string> = {
  "platform:commission": "Commission earned",
  "platform:ads": "Ad revenue",
  "platform:logistics": "Shipping, duty and VAT owed onward",
  "platform:promotions": "Coupons paid by the platform",
  "platform:adjustments": "Adjustments",
  "pending:payouts": "Payouts to send",
  "pending:refunds": "Refunds to send",
};

/** Where the money sits, from the ledger: platform accounts, escrow, and what shops and creators are owed. */
export async function ledgerSummary(db: Database): Promise<LedgerLine[]> {
  const kind = sql<string>`case when ${ledgerEntries.account} like 'escrow:%' then 'escrow' when ${ledgerEntries.account} like 'seller:%' then 'sellers' when ${ledgerEntries.account} like 'creator:%' then 'creators' when ${ledgerEntries.account} like 'treasury:%' then ${ledgerEntries.account} else ${ledgerEntries.account} end`;
  const rows = await db.select({ account: kind, total: sum(ledgerEntries.amountCents) }).from(ledgerEntries).groupBy(kind);
  const label = (a: string) =>
    PLATFORM_LABELS[a] ?? (a === "escrow" ? "Held in escrow" : a === "sellers" ? "Owed to shops" : a === "creators" ? "Owed to creators" : a.startsWith("treasury:") ? `Treasury (${a.slice(9)})` : a);
  return rows
    .map((r) => ({ account: r.account, label: label(r.account), balance: dollars(r.total) }))
    .filter((r) => r.balance !== 0)
    .sort((a, z) => Math.abs(z.balance) - Math.abs(a.balance));
}


export async function accountEmail(db: Database, accountId: string): Promise<string | null> {
  const [r] = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return r?.email ?? null;
}

export async function campaignSeller(db: Database, campaignId: string): Promise<string | null> {
  const [r] = await db.select({ sellerId: campaigns.sellerId }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  return r?.sellerId ?? null;
}
