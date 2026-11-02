import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { PushDevice } from "../domain/push";
import type { PushDeviceRepository } from "../domain/repositories";
import { pushDevices } from "./schema";

export class DrizzlePushDeviceRepository implements PushDeviceRepository {
  constructor(private readonly db: Database) {}

  async save(d: PushDevice) {
    await this.db
      .insert(pushDevices)
      .values(d)
      .onConflictDoUpdate({ target: pushDevices.endpoint, set: { accountId: d.accountId, p256dh: d.p256dh, auth: d.auth, createdAt: d.createdAt } });
  }

  async forAccount(accountId: string, limit: number) {
    return this.db.select().from(pushDevices).where(eq(pushDevices.accountId, accountId)).orderBy(desc(pushDevices.createdAt)).limit(limit);
  }

  async remove(accountId: string, endpoint: string) {
    await this.db.delete(pushDevices).where(and(eq(pushDevices.accountId, accountId), eq(pushDevices.endpoint, endpoint)));
  }

  async removeAll(accountId: string) {
    await this.db.delete(pushDevices).where(eq(pushDevices.accountId, accountId));
  }
}
