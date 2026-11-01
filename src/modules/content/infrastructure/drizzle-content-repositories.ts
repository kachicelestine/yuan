import { and, arrayContains, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { searchWords, toTsQuery } from "@/shared/infrastructure/ts-query";
import type { Report, ReportReason, ReportStatus, ReportTarget } from "../domain/moderation";
import type { Comment, LikeTarget, Note, Question, Review, TargetType } from "../domain/posts";
import type { CommentRepository, LikeRepository, NoteRepository, QuestionRepository, ReportedItem, ReportRepository, ReviewRepository, VideoRepository, VideoStats, WatchTally } from "../domain/repositories";
import type { Video } from "../domain/video";
import { comments, likes, notes, questions, reports, reviews, videoDaily, videos, videoStats } from "./schema";

/** The row without its encoding-queue bookkeeping, which only the queue methods touch. */
const toVideo = (r: typeof videos.$inferSelect): Video => {
  const v: Partial<typeof r> = { ...r };
  delete v.encodeAttempts;
  delete v.encodeAfter;
  delete v.encodeError;
  delete v.search;
  return v as Video;
};

export class DrizzleVideoRepository implements VideoRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(videos).where(eq(videos.id, id)).limit(1);
    return r ? toVideo(r) : null;
  }

  async findMany(ids: readonly string[]) {
    if (!ids.length) return [];
    return (await this.db.select().from(videos).where(inArray(videos.id, [...ids]))).map(toVideo);
  }

  async save(v: Video) {
    const row = { ...v, alsoSlugs: [...v.alsoSlugs], spots: [...v.spots], renditions: [...v.renditions], tags: [...v.tags] };
    await this.db.transaction(async (tx) => {
      await tx.insert(videos).values(row).onConflictDoUpdate({ target: videos.id, set: row });
      await tx.insert(videoStats).values({ videoId: v.id }).onConflictDoNothing();
    });
  }

  async listByStatus(status: Video["status"], limit: number) {
    return (await this.db.select().from(videos).where(eq(videos.status, status)).orderBy(asc(videos.createdAt)).limit(limit)).map(toVideo);
  }

  async listReady(filter: { sellerId?: string; sellerIds?: readonly string[]; authorIds?: readonly string[]; category?: string; limit: number; offset?: number }) {
    // Shops and people someone follows: videos from either.
    const followed = filter.sellerIds || filter.authorIds;
    const sellerIds = filter.sellerIds ?? [];
    const authorIds = filter.authorIds ?? [];
    if (followed && !sellerIds.length && !authorIds.length) return [];
    const rows = await this.db
      .select()
      .from(videos)
      .where(
        and(
          eq(videos.status, "ready"),
          filter.sellerId ? eq(videos.sellerId, filter.sellerId) : undefined,
          followed ? or(sellerIds.length ? inArray(videos.sellerId, [...sellerIds]) : undefined, authorIds.length ? inArray(videos.authorId, [...authorIds]) : undefined) : undefined,
          filter.category ? eq(videos.category, filter.category) : undefined,
        ),
      )
      .orderBy(desc(videos.publishedAt), asc(videos.id))
      .limit(filter.limit)
      .offset(filter.offset ?? 0);
    return rows.map(toVideo);
  }

  async search(text: string, productSlugs: readonly string[], limit: number) {
    const tsq = toTsQuery(text);
    const words = searchWords(text);
    const slugs = [...productSlugs];
    const array = (items: string[]) => sql`array[${sql.join(items.map((i) => sql`${i}`), sql`, `)}]::text[]`;
    const query = tsq ? sql`to_tsquery('english', ${tsq})` : null;
    const matches = [
      query ? sql`${videos.search} @@ ${query}` : undefined,
      words.length ? sql`${videos.tags} && ${array(words)}` : undefined,
      slugs.length ? inArray(videos.productSlug, slugs) : undefined,
      slugs.length ? sql`${videos.alsoSlugs} && ${array(slugs)}` : undefined,
    ].filter((m) => m !== undefined);
    if (!matches.length) return [];
    // Videos whose own words match come first, then by likes; the products they show count too.
    const own = query ? sql`ts_rank(${videos.search}, ${query})` : sql`0`;
    const rows = await this.db
      .select({ video: videos })
      .from(videos)
      .leftJoin(videoStats, eq(videoStats.videoId, videos.id))
      .where(and(eq(videos.status, "ready"), sql`(${sql.join(matches, sql` or `)})`))
      .orderBy(desc(own), sql`${videoStats.likes} desc nulls last`, desc(videos.publishedAt), asc(videos.id))
      .limit(limit);
    return rows.map((r) => toVideo(r.video));
  }

  async stats(ids: readonly string[]) {
    if (!ids.length) return new Map<string, VideoStats>();
    const rows = await this.db
      .select({ videoId: videoStats.videoId, likes: videoStats.likes, comments: videoStats.comments, saves: videoStats.saves, shares: videoStats.shares, views: videoStats.views })
      .from(videoStats)
      .where(inArray(videoStats.videoId, [...ids]));
    return new Map(rows.map(({ videoId, ...s }) => [videoId, s]));
  }

  async bump(id: string, delta: Partial<VideoStats>) {
    const set: Record<string, unknown> = {};
    for (const [key, by] of Object.entries(delta)) {
      if (!by) continue;
      const column = videoStats[key as keyof VideoStats];
      set[key] = sql`greatest(0, ${column} + ${by})`;
    }
    if (!Object.keys(set).length) return (await this.db.select({ id: videoStats.videoId }).from(videoStats).where(eq(videoStats.videoId, id)).limit(1)).length > 0;
    const rows = await this.db.update(videoStats).set(set).where(eq(videoStats.videoId, id)).returning({ id: videoStats.videoId });
    return rows.length > 0;
  }

  async listByAuthor(authorId: string, limit: number) {
    const rows = await this.db.select().from(videos).where(eq(videos.authorId, authorId)).orderBy(desc(videos.createdAt)).limit(limit);
    return rows.map(toVideo);
  }

  async listReadyByTag(tag: string, limit: number) {
    const rows = await this.db
      .select()
      .from(videos)
      .where(and(eq(videos.status, "ready"), arrayContains(videos.tags, [tag])))
      .orderBy(desc(videos.publishedAt), asc(videos.id))
      .limit(limit);
    return rows.map(toVideo);
  }

  async hasSource(sourceKey: string) {
    return (await this.db.select({ id: videos.id }).from(videos).where(eq(videos.sourceKey, sourceKey)).limit(1)).length > 0;
  }

  async claimForEncoding(now: Date, leaseUntil: Date, maxAttempts: number) {
    const [r] = await this.db
      .update(videos)
      .set({ encodeAfter: leaseUntil, encodeAttempts: sql`${videos.encodeAttempts} + 1` })
      .where(
        sql`${videos.id} = (
          select id from ${videos}
          where ${videos.status} = 'processing' and ${videos.encodeAttempts} < ${maxAttempts}
            and (${videos.encodeAfter} is null or ${videos.encodeAfter} <= ${now.toISOString()})
          order by ${videos.createdAt}
          limit 1
          for update skip locked
        )`,
      )
      .returning();
    return r ? { video: toVideo(r), attempt: r.encodeAttempts } : null;
  }

  async releaseEncoding(id: string, error: string, retryAt: Date) {
    await this.db.update(videos).set({ encodeAfter: retryAt, encodeError: error.slice(0, 1000) }).where(eq(videos.id, id));
  }

  async addWatches(tallies: readonly WatchTally[], day: string) {
    if (!tallies.length) return;
    const known = new Set((await this.db.select({ id: videos.id }).from(videos).where(inArray(videos.id, tallies.map((t) => t.videoId)))).map((r) => r.id));
    const rows = tallies.filter((t) => known.has(t.videoId));
    if (!rows.length) return;
    await this.db.transaction(async (tx) => {
      await tx
        .insert(videoDaily)
        .values(rows.map((t) => ({ videoId: t.videoId, day, views: t.views, watchMs: t.watchMs, completes: t.completes })))
        .onConflictDoUpdate({
          target: [videoDaily.videoId, videoDaily.day],
          set: {
            views: sql`${videoDaily.views} + excluded.views`,
            watchMs: sql`${videoDaily.watchMs} + excluded.watch_ms`,
            completes: sql`${videoDaily.completes} + excluded.completes`,
          },
        });
      // One statement for the whole batch: lifetime counters from a VALUES list.
      const values = sql.join(
        rows.map((t) => sql`(${t.videoId}::text, ${t.views}::bigint, ${t.watchMs}::bigint, ${t.completes}::bigint)`),
        sql`, `,
      );
      await tx.execute(sql`
        update ${videoStats} as s
        set views = s.views + v.views, watch_ms = s.watch_ms + v.watch_ms, completes = s.completes + v.completes
        from (values ${values}) as v(video_id, views, watch_ms, completes)
        where s.video_id = v.video_id`);
    });
  }
}

const toComment = (r: typeof comments.$inferSelect): Comment => r;

export class DrizzleCommentRepository implements CommentRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(comments).where(eq(comments.id, id)).limit(1);
    return r ? toComment(r) : null;
  }

  async add(c: Comment) {
    await this.db.insert(comments).values(c);
  }

  async remove(id: string) {
    const [r] = await this.db.delete(comments).where(eq(comments.id, id)).returning();
    return r ? toComment(r) : null;
  }

  async bumpLikes(id: string, delta: number) {
    const rows = await this.db.update(comments).set({ likes: sql`greatest(0, ${comments.likes} + ${delta})` }).where(eq(comments.id, id)).returning({ id: comments.id });
    return rows.length > 0;
  }

  async top(targetType: TargetType, targetIds: readonly string[], perTarget: number) {
    const result = new Map<string, Comment[]>();
    if (!targetIds.length) return result;
    // Ranked per target in SQL, so a video with 10k comments still costs one small read.
    const ranked = this.db
      .select({ id: comments.id, n: sql<number>`row_number() over (partition by ${comments.targetId} order by ${comments.likes} desc, ${comments.createdAt} desc)`.as("n") })
      .from(comments)
      .where(and(eq(comments.targetType, targetType), inArray(comments.targetId, [...targetIds])))
      .as("ranked");
    const rows = await this.db
      .select()
      .from(comments)
      .innerJoin(ranked, eq(ranked.id, comments.id))
      .where(sql`${ranked.n} <= ${perTarget}`)
      .orderBy(desc(comments.likes), desc(comments.createdAt));
    for (const { comments: c } of rows) result.set(c.targetId, [...(result.get(c.targetId) ?? []), toComment(c)]);
    return result;
  }

  async list(targetType: TargetType, targetId: string, limit: number, before?: Date) {
    const rows = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId), before ? lt(comments.createdAt, before) : undefined))
      .orderBy(desc(comments.createdAt))
      .limit(limit);
    return rows.map(toComment);
  }
}

export class DrizzleNoteRepository implements NoteRepository {
  constructor(private readonly db: Database) {}

  async list(filter: { category?: string; limit: number }) {
    const rows = await this.db
      .select()
      .from(notes)
      .where(and(eq(notes.inReview, false), filter.category ? eq(notes.category, filter.category) : undefined))
      .orderBy(desc(notes.createdAt), asc(notes.id))
      .limit(filter.limit);
    return rows as Note[];
  }

  async find(id: string) {
    const [r] = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);
    return (r as Note | undefined) ?? null;
  }

  async bumpLikes(id: string, delta: number) {
    const rows = await this.db.update(notes).set({ likes: sql`greatest(0, ${notes.likes} + ${delta})` }).where(eq(notes.id, id)).returning({ id: notes.id });
    return rows.length > 0;
  }

  async add(note: Note) {
    await this.db.insert(notes).values({ ...note, tags: [...note.tags] });
  }

  async listByAuthor(authorId: string, limit: number) {
    return (await this.db.select().from(notes).where(and(eq(notes.authorId, authorId), eq(notes.inReview, false))).orderBy(desc(notes.createdAt)).limit(limit)) as Note[];
  }

  async listByTag(tag: string, limit: number) {
    return (await this.db.select().from(notes).where(and(arrayContains(notes.tags, [tag]), eq(notes.inReview, false))).orderBy(desc(notes.createdAt)).limit(limit)) as Note[];
  }

  async listInReview(limit: number) {
    return (await this.db.select().from(notes).where(eq(notes.inReview, true)).orderBy(asc(notes.createdAt)).limit(limit)) as Note[];
  }

  async approve(id: string) {
    return (await this.db.update(notes).set({ inReview: false }).where(eq(notes.id, id)).returning({ id: notes.id })).length > 0;
  }

  async remove(id: string) {
    const [r] = await this.db.delete(notes).where(eq(notes.id, id)).returning();
    return (r as Note | undefined) ?? null;
  }
}

const toReview = (r: typeof reviews.$inferSelect): Review => r;

export class DrizzleReviewRepository implements ReviewRepository {
  constructor(private readonly db: Database) {}

  async countByAuthor(accountId: string) {
    return this.db.$count(reviews, eq(reviews.authorId, accountId));
  }

  async forProduct(slug: string, limit: number) {
    const rows = await this.db.select().from(reviews).where(eq(reviews.productSlug, slug)).orderBy(desc(reviews.helpful), desc(reviews.createdAt)).limit(limit);
    return rows.map(toReview);
  }

  async forSeller(sellerId: string, limit: number) {
    const rows = await this.db.select().from(reviews).where(eq(reviews.sellerId, sellerId)).orderBy(desc(reviews.createdAt)).limit(limit);
    return rows.map(toReview);
  }

  async ratings(slug: string) {
    const rows = await this.db.select({ rating: reviews.rating }).from(reviews).where(eq(reviews.productSlug, slug));
    return rows.map((r) => r.rating);
  }

  async exists(orderId: string, productSlug: string) {
    const [r] = await this.db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.orderId, orderId), eq(reviews.productSlug, productSlug))).limit(1);
    return Boolean(r);
  }

  async find(id: string) {
    const [r] = await this.db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    return r ? toReview(r) : null;
  }

  async add(review: Review) {
    await this.db.insert(reviews).values({ ...review, photos: [...review.photos] });
  }

  async remove(id: string) {
    const [r] = await this.db.delete(reviews).where(eq(reviews.id, id)).returning();
    return r ? toReview(r) : null;
  }

  async bumpHelpful(id: string, delta: number) {
    const rows = await this.db.update(reviews).set({ helpful: sql`greatest(0, ${reviews.helpful} + ${delta})` }).where(eq(reviews.id, id)).returning({ id: reviews.id });
    return rows.length > 0;
  }
}

export class DrizzleQuestionRepository implements QuestionRepository {
  constructor(private readonly db: Database) {}

  async forProduct(slug: string, limit: number) {
    const rows = await this.db
      .select()
      .from(questions)
      .where(and(eq(questions.productSlug, slug), isNotNull(questions.answer)))
      .orderBy(desc(questions.votes), desc(questions.createdAt))
      .limit(limit);
    return rows as Question[];
  }

  async find(id: string) {
    const [r] = await this.db.select().from(questions).where(eq(questions.id, id)).limit(1);
    return (r as Question | undefined) ?? null;
  }

  async unansweredForSeller(sellerId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(questions)
      .where(and(eq(questions.sellerId, sellerId), isNull(questions.answer)))
      .orderBy(asc(questions.createdAt))
      .limit(limit);
    return rows as Question[];
  }

  async add(q: Question) {
    await this.db.insert(questions).values(q);
  }

  async remove(id: string) {
    const [r] = await this.db.delete(questions).where(eq(questions.id, id)).returning();
    return (r as Question | undefined) ?? null;
  }

  async saveAnswer(q: Question) {
    await this.db.update(questions).set({ answer: q.answer, answeredBy: q.answeredBy }).where(and(eq(questions.id, q.id), isNull(questions.answer)));
  }

  async bumpVotes(id: string, delta: number) {
    const rows = await this.db.update(questions).set({ votes: sql`greatest(0, ${questions.votes} + ${delta})` }).where(eq(questions.id, id)).returning({ id: questions.id });
    return rows.length > 0;
  }
}

export class DrizzleLikeRepository implements LikeRepository {
  constructor(private readonly db: Database) {}

  async set(accountId: string, targetType: LikeTarget, targetId: string, liked: boolean) {
    if (liked) {
      const rows = await this.db.insert(likes).values({ accountId, targetType, targetId, createdAt: new Date() }).onConflictDoNothing().returning({ id: likes.targetId });
      return rows.length > 0;
    }
    const rows = await this.db
      .delete(likes)
      .where(and(eq(likes.accountId, accountId), eq(likes.targetType, targetType), eq(likes.targetId, targetId)))
      .returning({ id: likes.targetId });
    return rows.length > 0;
  }

  async likedBy(accountId: string, targetType: LikeTarget, targetIds: readonly string[]) {
    if (!targetIds.length) return new Set<string>();
    const rows = await this.db
      .select({ id: likes.targetId })
      .from(likes)
      .where(and(eq(likes.accountId, accountId), eq(likes.targetType, targetType), inArray(likes.targetId, [...targetIds])));
    return new Set(rows.map((r) => r.id));
  }
}

export class DrizzleReportRepository implements ReportRepository {
  constructor(private readonly db: Database) {}

  async add(r: Report) {
    const rows = await this.db.insert(reports).values(r).onConflictDoNothing().returning({ id: reports.id });
    return rows.length > 0;
  }

  async openItems(limit: number): Promise<ReportedItem[]> {
    const rows = await this.db
      .select({
        targetType: reports.targetType,
        targetId: reports.targetId,
        count: sql<number>`count(*)::int`,
        // Cast: drivers return arrays of custom enums as raw "{a,b}" text.
        reasons: sql<ReportReason[]>`array_agg(distinct ${reports.reason}::text)`,
        notes: sql<(string | null)[]>`array_agg(${reports.note} order by ${reports.createdAt})`,
        firstAt: sql<Date>`min(${reports.createdAt})`,
      })
      .from(reports)
      .where(eq(reports.status, "open"))
      .groupBy(reports.targetType, reports.targetId)
      .orderBy(sql`count(*) desc`, sql`min(${reports.createdAt})`)
      .limit(limit);
    return rows.map((r) => ({ ...r, notes: r.notes.filter((n): n is string => !!n), firstAt: new Date(r.firstAt) }));
  }

  async resolve(targetType: ReportTarget, targetId: string, status: Exclude<ReportStatus, "open">, by: string | null, at: Date) {
    const rows = await this.db
      .update(reports)
      .set({ status, resolvedAt: at, resolvedBy: by })
      .where(and(eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.status, "open")))
      .returning({ id: reports.id });
    return rows.length;
  }
}
