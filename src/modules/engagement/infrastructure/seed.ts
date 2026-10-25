import { count } from "drizzle-orm";
import { boards as boardFixtures, coupons as couponFixtures, rewardStore } from "@/fixtures/account";
import { nightMarket } from "@/fixtures/blindbox";
import { chops as chopFixtures } from "@/fixtures/chops";
import { flashDeals, teamBuys } from "@/fixtures/deals";
import { drops as dropFixtures } from "@/fixtures/drops";
import { products as productFixtures } from "@/fixtures/products";
import type { Database } from "@/shared/infrastructure/database";
import { money } from "@/shared/kernel";
import { newId } from "@/shared/kernel";
import { festivalWindow } from "../domain/deposit";
import { blindSeries, boards, chopOffers, coupons, depositOffers, drops, rewards, teamOffers } from "./schema";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 30" in the design fixtures: the end of that day in Beijing, in 2026. */
export function fixtureExpiry(label: string) {
  const [mon, day] = label.split(" ");
  return new Date(Date.UTC(2026, MONTHS.indexOf(mon), Number(day), 15, 59, 59));
}

/** Loads the design-phase coupons and coin rewards. Each part skips when it already has data. */
export async function seedEngagement(db: Database) {
  const [[{ value: haveCoupons }], [{ value: haveRewards }]] = await Promise.all([db.select({ value: count() }).from(coupons), db.select({ value: count() }).from(rewards)]);
  if (haveCoupons > 0 && haveRewards > 0) return { skipped: true };
  if (!haveCoupons) await insertCoupons(db);
  if (!haveRewards) await db.insert(rewards).values(rewardStore.map((r) => ({ id: r.id, title: r.title, cost: r.cost, couponId: r.couponId })));
  return { skipped: false, coupons: couponFixtures.length, rewards: rewardStore.length };
}

/** The design-phase chops become offers from the shops that sell those products. */
export async function seedChopOffers(db: Database) {
  const [{ value: have }] = await db.select({ value: count() }).from(chopOffers);
  if (have > 0) return { skipped: true };
  const rows = chopFixtures.flatMap((c) => {
    const p = productFixtures.find((x) => x.slug === c.slug);
    if (!p?.price) return [];
    return [{ id: newId(), sellerId: p.sellerId, slug: p.slug, fullPriceCents: money.fromDollars(p.price), targetCents: money.fromDollars(c.target), cuts: c.cuts, hours: 24, remaining: 50, active: true, createdAt: new Date("2026-10-20T00:00:00Z") }];
  });
  if (rows.length) await db.insert(chopOffers).values(rows);
  return { skipped: false, offers: rows.length };
}

/**
 * The design-phase drops, night deals and team buys as real ones from the shops that sell
 * those products: deals are live now, drops open on the days the fixtures give, in
 * Beijing time. Pre-orders and pre-sales are deposit offers (see seedDeposits).
 */
export async function seedPromos(db: Database, now = new Date()) {
  const [{ value: have }] = await db.select({ value: count() }).from(drops);
  if (have > 0) return { skipped: true };
  const product = (slug: string) => productFixtures.find((p) => p.slug === slug);
  const beijingMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 8 * 3_600_000;
  const rows = [
    ...flashDeals.flatMap((d) => {
      const p = product(d.slug);
      if (!p?.price) return [];
      const stock = 200;
      return [{ id: newId(), sellerId: p.sellerId, slug: p.slug, kind: "drop" as const, title: `Night deal: ${p.title}`, blurb: "Today only, while the stock lasts.", startsAt: new Date(now.getTime() - 3_600_000), endsAt: new Date(now.getTime() + 23 * 3_600_000), priceCents: money.fromDollars(d.dealPrice), stock, perPerson: 2, claimed: Math.round((stock * d.claimed) / 100), cancelled: false, createdAt: now }];
    }),
    ...dropFixtures.flatMap((d) => {
      const p = product(d.slug);
      if (!p?.price || (d.kind !== "drop" && d.kind !== "restock")) return [];
      const [h, m] = d.time.split(":").map(Number);
      const startsAt = new Date(beijingMidnight + d.inDays * 86_400_000 + (h * 60 + m) * 60_000);
      const drop = d.kind === "drop";
      return [{ id: newId(), sellerId: p.sellerId, slug: p.slug, kind: d.kind, title: d.title, blurb: d.blurb, startsAt, endsAt: new Date(startsAt.getTime() + 24 * 3_600_000), priceCents: drop ? money.fromDollars(Math.round(p.price * 0.85 * 100) / 100) : null, stock: drop ? 500 : null, perPerson: 1, claimed: 0, cancelled: false, createdAt: now }];
    }),
  ];
  if (rows.length) await db.insert(drops).values(rows);
  const offers = teamBuys.flatMap((t) => {
    const p = product(t.slug);
    if (!p?.price) return [];
    return [{ id: newId(), sellerId: p.sellerId, slug: p.slug, fullPriceCents: money.fromDollars(p.price), teamPriceCents: money.fromDollars(t.teamPrice), size: t.size, hours: 24, remaining: 100, active: true, createdAt: now }];
  });
  if (offers.length) await db.insert(teamOffers).values(offers);
  return { skipped: false, drops: rows.length, teamOffers: offers.length };
}

/**
 * The design-phase creator boards as public boards (with no followers: those come from
 * people following them). The "You" boards were the demo shopper's and are left out.
 */
export async function seedBoards(db: Database, now = new Date()) {
  const [{ value: have }] = await db.select({ value: count() }).from(boards);
  if (have > 0) return { skipped: true };
  const ids: Record<string, string> = { "off-grid": "offgrid2", "fit-check": "fitcheck", "glow-up": "glowup30" };
  const owners = new Map<string, string>();
  const rows = boardFixtures.flatMap((b, i) => {
    if (b.owner === "You" || !ids[b.id]) return [];
    if (!owners.has(b.owner)) owners.set(b.owner, `00000000-0000-4000-8000-${String(owners.size + 1).padStart(12, "0")}`);
    const at = new Date(now.getTime() - (i + 1) * 86_400_000);
    return [{ id: ids[b.id], ownerId: owners.get(b.owner)!, ownerName: b.owner, name: b.name, slugs: b.slugs, public: true, createdAt: at, updatedAt: at }];
  });
  if (rows.length) await db.insert(boards).values(rows);
  return { skipped: false, boards: rows.length };
}

/** The design-phase blind-box series, sold by the shop that lists its box. */
export async function seedBlindBoxes(db: Database, now = new Date()) {
  const [{ value: have }] = await db.select({ value: count() }).from(blindSeries);
  if (have > 0) return { skipped: true };
  const product = productFixtures.find((p) => p.slug === nightMarket.slug);
  if (!product) return { skipped: true };
  await db.insert(blindSeries).values({
    id: nightMarket.id,
    sellerId: product.sellerId,
    slug: nightMarket.slug,
    title: nightMarket.title,
    poster: nightMarket.poster,
    figures: nightMarket.figures.map((f) => ({ id: f.id, name: f.name, image: f.image, secret: !!f.secret })),
    secretOdds: nightMarket.secretOdds,
    shakesPerCase: 3,
    active: true,
    createdAt: now,
  });
  return { skipped: false, series: 1 };
}

/**
 * The design-phase pre-orders and the 11.11 pre-sale, as real deposit offers from the
 * shops that sell those listings. Pre-orders pay the balance from 15 December.
 */
export async function seedDeposits(db: Database, now = new Date()) {
  const [{ value: have }] = await db.select({ value: count() }).from(depositOffers);
  if (have > 0) return { skipped: true };
  const festival = festivalWindow(now.getUTCFullYear());
  const rows = dropFixtures.flatMap((d) => {
    const p = productFixtures.find((x) => x.slug === d.slug);
    if (!p?.price || !d.deposit || (d.kind !== "preorder" && d.kind !== "presale")) return [];
    const presale = d.kind === "presale";
    if (presale && now >= festival.from) return [];
    const balanceFrom = presale ? festival.from : new Date(Date.UTC(now.getUTCFullYear(), 11, 15, 1));
    return [
      {
        id: newId(),
        sellerId: p.sellerId,
        slug: p.slug,
        kind: d.kind,
        title: d.title,
        blurb: d.blurb,
        depositCents: money.fromDollars(d.deposit.pay),
        creditCents: money.fromDollars(d.deposit.worth),
        priceCents: money.fromDollars(p.price),
        opensAt: new Date(now.getTime() - 3_600_000),
        closesAt: presale ? festival.from : new Date(balanceFrom.getTime() - 86_400_000),
        balanceFrom,
        balanceUntil: presale ? festival.until : new Date(balanceFrom.getTime() + 7 * 86_400_000),
        stock: 500,
        perPerson: presale ? 1 : 2,
        taken: 0,
        cancelled: false,
        createdAt: now,
      },
    ];
  });
  if (rows.length) await db.insert(depositOffers).values(rows);
  return { skipped: false, offers: rows.length };
}

async function insertCoupons(db: Database) {
  await db.insert(coupons).values(
    couponFixtures.map((c) => ({
      id: c.id,
      kind: c.freeShipping ? ("free_shipping" as const) : c.percent ? ("percent" as const) : ("amount" as const),
      value: c.percent ? c.value : c.freeShipping ? 0 : money.fromDollars(c.value),
      minSpendCents: money.fromDollars(c.minSpend),
      sellerId: c.sellerId ?? null,
      title: c.title,
      detail: c.detail,
      expiresAt: fixtureExpiry(c.expires),
    })),
  );
}
