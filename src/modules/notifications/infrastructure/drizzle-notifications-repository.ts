import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Notification } from "../domain/notification";
import type { NotificationRepository } from "../domain/repositories";
import { notifications } from "./schema";

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Database) {}

  async add(n: Notification) {
    const rows = await this.db.insert(notifications).values(n).onConflictDoNothing().returning({ id: notifications.id });
    return rows.length > 0;
  }

  async listFor(accountId: string, limit: number) {
    return this.db.select().from(notifications).where(eq(notifications.accountId, accountId)).orderBy(desc(notifications.createdAt)).limit(limit);
  }

  async unread(accountId: string) {
    const [r] = await this.db.select({ n: count() }).from(notifications).where(and(eq(notifications.accountId, accountId), isNull(notifications.readAt)));
    return r?.n ?? 0;
  }

  async markAllRead(accountId: string, at: Date) {
    await this.db.update(notifications).set({ readAt: at }).where(and(eq(notifications.accountId, accountId), isNull(notifications.readAt)));
  }
}
