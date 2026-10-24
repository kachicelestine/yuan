import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { ShipmentRepository } from "../domain/repositories";
import type { Shipment, ShipmentStatus } from "../domain/shipment";
import { orders, shipments } from "./schema";

const toShipment = (r: typeof shipments.$inferSelect): Shipment => ({
  orderId: r.orderId,
  sellerId: r.sellerId,
  status: r.status,
  amount: cents(r.amountCents),
  carrier: r.carrier,
  tracking: r.tracking,
  shippedAt: r.shippedAt,
  deliveredAt: r.deliveredAt,
  confirmedBy: r.confirmedBy as Shipment["confirmedBy"],
  dispute: r.disputeReason && r.disputeOpenedAt ? { reason: r.disputeReason, note: r.disputeNote, openedAt: r.disputeOpenedAt } : null,
  resolution:
    r.resolution && r.resolvedAt && r.resolvedBy ? { outcome: r.resolution as "refund" | "release", note: r.resolutionNote ?? "", by: r.resolvedBy, at: r.resolvedAt } : null,
});

const toRow = (s: Shipment) => ({
  orderId: s.orderId,
  sellerId: s.sellerId,
  status: s.status,
  amountCents: s.amount,
  carrier: s.carrier,
  tracking: s.tracking,
  shippedAt: s.shippedAt,
  deliveredAt: s.deliveredAt,
  confirmedBy: s.confirmedBy,
  disputeReason: s.dispute?.reason ?? null,
  disputeNote: s.dispute?.note ?? null,
  disputeOpenedAt: s.dispute?.openedAt ?? null,
  resolution: s.resolution?.outcome ?? null,
  resolutionNote: s.resolution?.note ?? null,
  resolvedBy: s.resolution?.by ?? null,
  resolvedAt: s.resolution?.at ?? null,
});

export class DrizzleShipmentRepository implements ShipmentRepository {
  constructor(private readonly db: Database) {}

  async forOrder(orderId: string) {
    return (await this.db.select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(asc(shipments.sellerId))).map(toShipment);
  }

  async find(orderId: string, sellerId: string) {
    const [r] = await this.db.select().from(shipments).where(and(eq(shipments.orderId, orderId), eq(shipments.sellerId, sellerId))).limit(1);
    return r ? toShipment(r) : null;
  }

  async save(s: Shipment) {
    const row = toRow(s);
    await this.db.insert(shipments).values(row).onConflictDoUpdate({ target: [shipments.orderId, shipments.sellerId], set: row });
  }

  async forSeller(sellerId: string, statuses: readonly ShipmentStatus[], limit: number) {
    if (!statuses.length) return [];
    const rows = await this.db
      .select({ s: shipments })
      .from(shipments)
      .innerJoin(orders, eq(orders.id, shipments.orderId))
      .where(and(eq(shipments.sellerId, sellerId), inArray(shipments.status, [...statuses])))
      .orderBy(desc(orders.placedAt))
      .limit(limit);
    return rows.map((r) => toShipment(r.s));
  }

  async dueForAutoConfirm(before: Date, limit: number) {
    const rows = await this.db
      .select()
      .from(shipments)
      .where(and(eq(shipments.status, "shipped"), lt(shipments.shippedAt, before)))
      .orderBy(asc(shipments.shippedAt))
      .limit(limit);
    return rows.map(toShipment);
  }

  async disputed(limit: number) {
    return (await this.db.select().from(shipments).where(eq(shipments.status, "disputed")).orderBy(asc(shipments.disputeOpenedAt)).limit(limit)).map(toShipment);
  }
}
