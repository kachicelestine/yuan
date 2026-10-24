import { count } from "drizzle-orm";
import { coupons as couponFixtures, rewardStore } from "@/fixtures/account";
import type { Database } from "@/shared/infrastructure/database";
import { money } from "@/shared/kernel";
import { coupons, rewards } from "./schema";

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
