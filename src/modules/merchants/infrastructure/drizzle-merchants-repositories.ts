import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Application, ApplicationStatus } from "../domain/application";
import type { Membership } from "../domain/membership";
import type { ApplicationRepository, MembershipRepository } from "../domain/repositories";
import { applications, members } from "./schema";

const toApplication = (r: typeof applications.$inferSelect): Application => {
  const { handle: _handle, documents, ...rest } = r;
  void _handle;
  return { ...rest, documents: documents.map((d) => ({ ...d, uploadedAt: new Date(d.uploadedAt) })) };
};

export class DrizzleApplicationRepository implements ApplicationRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return r ? toApplication(r) : null;
  }

  async findByAccount(accountId: string) {
    const [r] = await this.db.select().from(applications).where(eq(applications.accountId, accountId)).orderBy(desc(applications.createdAt)).limit(1);
    return r ? toApplication(r) : null;
  }

  async save(a: Application) {
    const row = {
      ...a,
      handle: a.business?.handle ?? null,
      documents: a.documents.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() })),
    };
    await this.db.insert(applications).values(row).onConflictDoUpdate({ target: applications.id, set: row });
  }

  async findBySeller(sellerId: string) {
    const [r] = await this.db.select().from(applications).where(and(eq(applications.sellerId, sellerId), eq(applications.status, "approved"))).limit(1);
    return r ? toApplication(r) : null;
  }

  async listByStatus(status: ApplicationStatus, limit: number) {
    const rows = await this.db.select().from(applications).where(eq(applications.status, status)).orderBy(asc(applications.submittedAt), asc(applications.createdAt)).limit(limit);
    return rows.map(toApplication);
  }

  async handleClaimed(handle: string, exceptId: string) {
    const rows = await this.db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.handle, handle), ne(applications.id, exceptId), ne(applications.status, "rejected")))
      .limit(1);
    return rows.length > 0;
  }
}

export class DrizzleMembershipRepository implements MembershipRepository {
  constructor(private readonly db: Database) {}

  async forAccount(accountId: string): Promise<Membership[]> {
    return this.db.select().from(members).where(eq(members.accountId, accountId)).orderBy(asc(members.since));
  }

  async forSeller(sellerId: string): Promise<Membership[]> {
    return this.db.select().from(members).where(eq(members.sellerId, sellerId)).orderBy(asc(members.since));
  }

  async find(sellerId: string, accountId: string) {
    const [r] = await this.db.select().from(members).where(and(eq(members.sellerId, sellerId), eq(members.accountId, accountId))).limit(1);
    return r ?? null;
  }

  async add(m: Membership) {
    await this.db.insert(members).values(m).onConflictDoNothing();
  }
}
