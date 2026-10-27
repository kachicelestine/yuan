import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Follow, Profile } from "../domain/profile";
import type { FollowCounts, FollowRepository, ProfileRepository } from "../domain/repositories";
import { follows, profiles } from "./schema";

const toProfile = (r: typeof profiles.$inferSelect): Profile => ({ ...r });

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly db: Database) {}

  async find(accountId: string) {
    const [r] = await this.db.select().from(profiles).where(eq(profiles.accountId, accountId)).limit(1);
    return r ? toProfile(r) : null;
  }

  async findByHandle(handle: string) {
    const [r] = await this.db.select().from(profiles).where(eq(profiles.handle, handle)).limit(1);
    return r ? toProfile(r) : null;
  }

  async findMany(accountIds: readonly string[]) {
    if (!accountIds.length) return [];
    return (await this.db.select().from(profiles).where(inArray(profiles.accountId, [...accountIds]))).map(toProfile);
  }

  /** Insert or update in one statement; a handle clash (unique index) answers false. */
  async save(p: Profile) {
    const rows = await this.db
      .insert(profiles)
      .values(p)
      .onConflictDoUpdate({ target: profiles.accountId, set: { handle: p.handle, name: p.name, bio: p.bio, avatar: p.avatar, updatedAt: p.updatedAt } })
      .returning({ id: profiles.accountId })
      .catch((e: unknown) => {
        if (isUniqueViolation(e)) return [];
        throw e;
      });
    return rows.length === 1;
  }

  async search(text: string, limit: number) {
    const like = `%${text.slice(0, 40).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return (
      await this.db
        .select()
        .from(profiles)
        .where(or(ilike(profiles.handle, like), ilike(profiles.name, like)))
        .orderBy(sql`${profiles.handle} = ${text.toLowerCase()} desc`, profiles.handle)
        .limit(limit)
    ).map(toProfile);
  }
}

/** Postgres unique_violation, however the driver wraps it. */
function isUniqueViolation(e: unknown): boolean {
  for (let x: unknown = e; x && typeof x === "object"; x = (x as { cause?: unknown }).cause) if ((x as { code?: string }).code === "23505") return true;
  return false;
}

export class DrizzleFollowRepository implements FollowRepository {
  constructor(private readonly db: Database) {}

  async set(f: Follow, on: boolean) {
    if (on) return (await this.db.insert(follows).values(f).onConflictDoNothing().returning({ id: follows.followerId })).length === 1;
    return (await this.db.delete(follows).where(and(eq(follows.followerId, f.followerId), eq(follows.followeeId, f.followeeId))).returning({ id: follows.followerId })).length === 1;
  }

  async isFollowing(followerId: string, followeeId: string) {
    const [r] = await this.db.select({ id: follows.followerId }).from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId))).limit(1);
    return !!r;
  }

  async followees(followerId: string, limit: number) {
    return (await this.db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, followerId)).orderBy(desc(follows.at)).limit(limit)).map((r) => r.id);
  }

  async followers(followeeId: string, limit: number) {
    return (await this.db.select({ id: follows.followerId }).from(follows).where(eq(follows.followeeId, followeeId)).orderBy(desc(follows.at)).limit(limit)).map((r) => r.id);
  }

  async counts(accountIds: readonly string[]) {
    const out = new Map<string, FollowCounts>();
    if (!accountIds.length) return out;
    const ids = [...accountIds];
    const [by, of] = await Promise.all([
      this.db.select({ id: follows.followeeId, n: count() }).from(follows).where(inArray(follows.followeeId, ids)).groupBy(follows.followeeId),
      this.db.select({ id: follows.followerId, n: count() }).from(follows).where(inArray(follows.followerId, ids)).groupBy(follows.followerId),
    ]);
    for (const id of ids) out.set(id, { followers: by.find((r) => r.id === id)?.n ?? 0, following: of.find((r) => r.id === id)?.n ?? 0 });
    return out;
  }
}
