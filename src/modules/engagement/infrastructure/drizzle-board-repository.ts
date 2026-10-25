import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Board } from "../domain/board";
import type { BoardRepository } from "../domain/repositories";
import { boardFollows, boards } from "./schema";

export class DrizzleBoardRepository implements BoardRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(boards).where(eq(boards.id, id)).limit(1);
    return r ?? null;
  }

  async save(b: Board) {
    const values = { ...b, slugs: [...b.slugs] };
    await this.db.insert(boards).values(values).onConflictDoUpdate({ target: boards.id, set: { name: b.name, slugs: [...b.slugs], public: b.public, updatedAt: b.updatedAt } });
  }

  async remove(id: string) {
    await this.db.transaction(async (tx) => {
      await tx.delete(boardFollows).where(eq(boardFollows.boardId, id));
      await tx.delete(boards).where(eq(boards.id, id));
    });
  }

  async forOwner(accountId: string) {
    return this.db.select().from(boards).where(eq(boards.ownerId, accountId)).orderBy(desc(boards.createdAt));
  }

  async popular(limit: number) {
    const rows = await this.db
      .select({ board: boards, n: sql<number>`count(${boardFollows.accountId})::int` })
      .from(boards)
      .leftJoin(boardFollows, eq(boardFollows.boardId, boards.id))
      .where(and(eq(boards.public, true), sql`cardinality(${boards.slugs}) >= 3`))
      .groupBy(boards.id)
      .orderBy(desc(sql`count(${boardFollows.accountId})`), desc(boards.updatedAt))
      .limit(limit);
    return rows.map((r) => r.board);
  }

  async followedBy(accountId: string) {
    const rows = await this.db
      .select({ board: boards })
      .from(boardFollows)
      .innerJoin(boards, eq(boards.id, boardFollows.boardId))
      .where(and(eq(boardFollows.accountId, accountId), eq(boards.public, true)))
      .orderBy(desc(boardFollows.at));
    return rows.map((r) => r.board);
  }

  async followers(boardIds: readonly string[]) {
    if (!boardIds.length) return new Map<string, number>();
    const rows = await this.db
      .select({ id: boardFollows.boardId, n: count() })
      .from(boardFollows)
      .where(inArray(boardFollows.boardId, [...boardIds]))
      .groupBy(boardFollows.boardId);
    return new Map(rows.map((r) => [r.id, r.n]));
  }

  async following(accountId: string, boardIds: readonly string[]) {
    if (!boardIds.length) return new Set<string>();
    const rows = await this.db
      .select({ id: boardFollows.boardId })
      .from(boardFollows)
      .where(and(eq(boardFollows.accountId, accountId), inArray(boardFollows.boardId, [...boardIds])));
    return new Set(rows.map((r) => r.id));
  }

  async follow(boardId: string, accountId: string, at: Date) {
    await this.db.insert(boardFollows).values({ boardId, accountId, at }).onConflictDoNothing();
  }

  async unfollow(boardId: string, accountId: string) {
    await this.db.delete(boardFollows).where(and(eq(boardFollows.boardId, boardId), eq(boardFollows.accountId, accountId)));
  }
}
