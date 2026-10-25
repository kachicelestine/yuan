import { asc, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Poll, PollVote } from "../domain/poll";
import type { PollRepository } from "../domain/repositories";
import { pollVotes, polls } from "./schema";

/** Polls stay small (a day of votes from friends); a poll's votes are read whole, capped. */
const MAX_VOTES = 5000;

export class DrizzlePollRepository implements PollRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(polls).where(eq(polls.id, id)).limit(1);
    return r ?? null;
  }

  async create(p: Poll) {
    const rows = await this.db
      .insert(polls)
      .values({ ...p, slugs: [...p.slugs] })
      .onConflictDoNothing()
      .returning({ id: polls.id });
    return rows.length > 0;
  }

  async votes(pollId: string): Promise<PollVote[]> {
    return this.db.select().from(pollVotes).where(eq(pollVotes.pollId, pollId)).orderBy(asc(pollVotes.at)).limit(MAX_VOTES);
  }

  async vote(v: PollVote) {
    await this.db
      .insert(pollVotes)
      .values(v)
      .onConflictDoUpdate({
        target: [pollVotes.pollId, pollVotes.voter],
        set: {
          choice: v.choice,
          // A changed mind drops the old reason; the same pick keeps it unless a new one is given.
          reason: sql`case when excluded.choice <> ${pollVotes.choice} then excluded.reason else coalesce(excluded.reason, ${pollVotes.reason}) end`,
          name: v.name,
          at: v.at,
        },
      });
  }

  async byAuthor(authorId: string, limit: number) {
    return this.db.select().from(polls).where(eq(polls.authorId, authorId)).orderBy(desc(polls.createdAt)).limit(limit);
  }
}
