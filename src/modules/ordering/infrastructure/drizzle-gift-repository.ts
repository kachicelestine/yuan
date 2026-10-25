import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Gift } from "../domain/gift";
import type { GiftRepository } from "../domain/repositories";
import { gifts } from "./schema";

export class DrizzleGiftRepository implements GiftRepository {
  constructor(private readonly db: Database) {}

  async save(g: Gift) {
    await this.db
      .insert(gifts)
      .values(g)
      .onConflictDoUpdate({ target: gifts.orderId, set: { choice: g.choice, claimedAt: g.claimedAt, claimedBy: g.claimedBy, thanks: g.thanks } });
  }

  async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
    const [g] = await this.db.select().from(gifts).where(eq(gifts.token, token)).limit(1);
    return g ?? null;
  }

  async forOrders(orderIds: readonly string[]) {
    if (!orderIds.length) return [];
    return this.db.select().from(gifts).where(inArray(gifts.orderId, [...orderIds]));
  }
}
