import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { Order } from "../domain/order";
import type { OrderRepository } from "../domain/repositories";
import { orderLines, orders } from "./schema";

export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly db: Database) {}

  findById(id: string) {
    return this.load(eq(orders.id, id));
  }

  findByNumber(number: string) {
    return this.load(eq(orders.number, number));
  }

  async listByBuyer(buyerId: string, limit: number) {
    const rows = await this.db.select().from(orders).where(eq(orders.buyerId, buyerId)).orderBy(desc(orders.placedAt)).limit(limit);
    return Promise.all(rows.map((o) => this.withLines(o)));
  }

  async listBySeller(sellerId: string, statuses: readonly Order["status"][], limit: number) {
    if (!statuses.length) return [];
    const rows = await this.db
      .select()
      .from(orders)
      .where(and(inArray(orders.status, [...statuses]), sql`exists (select 1 from ${orderLines} where ${orderLines.orderId} = ${orders.id} and ${orderLines.sellerId} = ${sellerId})`))
      .orderBy(desc(orders.placedAt))
      .limit(limit);
    return Promise.all(rows.map((o) => this.withLines(o)));
  }

  private async load(where: ReturnType<typeof eq>): Promise<Order | null> {
    const [o] = await this.db.select().from(orders).where(where).limit(1);
    return o ? this.withLines(o) : null;
  }

  private async withLines(o: typeof orders.$inferSelect): Promise<Order> {
    const lines = await this.db.select().from(orderLines).where(eq(orderLines.orderId, o.id)).orderBy(asc(orderLines.position));
    return {
      id: o.id,
      number: o.number,
      buyerId: o.buyerId,
      status: o.status,
      country: o.country,
      shippingMethod: o.shippingMethod,
      placedAt: o.placedAt,
      paidAt: o.paidAt,
      pricing: {
        subtotal: cents(o.subtotalCents),
        discount: cents(o.discountCents),
        shipping: cents(o.shippingCents),
        duty: cents(o.dutyCents),
        vat: cents(o.vatCents),
        dueAtDoor: cents(o.dueAtDoorCents),
        total: cents(o.totalCents),
        parcels: o.parcels,
        couponId: o.couponId,
      },
      lines: lines.map((l) => ({
        productId: l.productId,
        slug: l.slug,
        title: l.title,
        image: l.image,
        sellerId: l.sellerId,
        option: l.option,
        unitPrice: cents(l.unitPriceCents),
        qty: l.qty,
      })),
    };
  }

  async transition(orderId: string, from: Order["status"], to: Order["status"]) {
    const rows = await this.db.update(orders).set({ status: to }).where(and(eq(orders.id, orderId), eq(orders.status, from))).returning({ id: orders.id });
    return rows.length > 0;
  }

  /** Inserts a new order with its lines, or updates an existing order's status. Lines never change. */
  async save(o: Order) {
    const [existing] = await this.db.select({ id: orders.id }).from(orders).where(eq(orders.id, o.id)).limit(1);
    if (existing) {
      await this.db.update(orders).set({ status: o.status, paidAt: o.paidAt }).where(eq(orders.id, o.id));
      return;
    }
    const p = o.pricing;
    await this.db.insert(orders).values({
      id: o.id,
      number: o.number,
      buyerId: o.buyerId,
      status: o.status,
      country: o.country,
      shippingMethod: o.shippingMethod,
      subtotalCents: p.subtotal,
      discountCents: p.discount,
      shippingCents: p.shipping,
      dutyCents: p.duty,
      vatCents: p.vat,
      dueAtDoorCents: p.dueAtDoor,
      totalCents: p.total,
      parcels: p.parcels,
      couponId: p.couponId,
      placedAt: o.placedAt,
      paidAt: o.paidAt,
    });
    await this.db.insert(orderLines).values(
      o.lines.map((l, position) => ({
        orderId: o.id,
        position,
        productId: l.productId,
        slug: l.slug,
        title: l.title,
        image: l.image,
        sellerId: l.sellerId,
        option: l.option,
        unitPriceCents: l.unitPrice,
        qty: l.qty,
      })),
    );
  }
}
