import { asc, eq } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { CartItem } from "../domain/cart";
import type { CartRepository } from "../domain/repositories";
import { cartItems } from "./schema";

export class DrizzleCartRepository implements CartRepository {
  constructor(private readonly db: Database) {}

  async get(buyerId: string): Promise<CartItem[]> {
    const rows = await this.db.select().from(cartItems).where(eq(cartItems.buyerId, buyerId)).orderBy(asc(cartItems.position));
    return rows.map((r) => ({ slug: r.slug, option: r.option || null, qty: r.qty, note: r.note }));
  }

  /** Replaces the whole bag in one transaction, keeping the line order. */
  async replace(buyerId: string, items: readonly CartItem[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(cartItems).where(eq(cartItems.buyerId, buyerId));
      if (items.length) {
        await tx.insert(cartItems).values(items.map((i, position) => ({ buyerId, slug: i.slug, option: i.option ?? "", qty: i.qty, note: i.note, position })));
      }
    });
  }
}
