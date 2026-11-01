import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { accounts } from "@/modules/identity/infrastructure/schema";
import { adminActions } from "@/shared/infrastructure/platform-schema";
import { newId } from "@/shared/kernel";

/** What admins can do, as the audit log names it. */
export type AdminAction =
  | "account.suspend"
  | "account.restore"
  | "shop.suspend"
  | "shop.restore"
  | "shop.verify"
  | "shop.unverify"
  | "listing.remove"
  | "listing.restore"
  | "parcel.refund"
  | "dispute.resolve"
  | "content.remove"
  | "content.keep"
  | "video.approve"
  | "photo.approve"
  | "show.end"
  | "campaign.pause"
  | "coupon.issue"
  | "coupon.end"
  | "application.approve"
  | "application.reject"
  | "payout.sent"
  | "payout.cancel";

export type AuditEntryView = { id: string; adminId: string; adminEmail: string | null; action: string; targetType: string; targetId: string; note: string | null; at: string };

/** Writes one line to the audit log. Called after the decision itself succeeded. */
export async function recordAdmin(db: Database, entry: { adminId: string; action: AdminAction; targetType: string; targetId: string; note?: string | null; at?: Date }) {
  await db.insert(adminActions).values({
    id: newId(),
    adminId: entry.adminId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    note: entry.note?.slice(0, 2000) ?? null,
    at: entry.at ?? new Date(),
  });
}

/** Newest first; narrowed to one thing when a target is given. */
export async function auditLog(db: Database, opts: { limit?: number; target?: { type: string; id: string } } = {}): Promise<AuditEntryView[]> {
  const rows = await db
    .select({ a: adminActions, email: accounts.email })
    .from(adminActions)
    .leftJoin(accounts, eq(accounts.id, adminActions.adminId))
    .where(opts.target ? and(eq(adminActions.targetType, opts.target.type), eq(adminActions.targetId, opts.target.id)) : undefined)
    .orderBy(desc(adminActions.at))
    .limit(opts.limit ?? 100);
  return rows.map(({ a, email }) => ({ id: a.id, adminId: a.adminId, adminEmail: email, action: a.action, targetType: a.targetType, targetId: a.targetId, note: a.note, at: a.at.toISOString() }));
}
