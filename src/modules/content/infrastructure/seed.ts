import { count } from "drizzle-orm";
import { notes as noteFixtures } from "@/fixtures/notes";
import { products as productFixtures } from "@/fixtures/products";
import { questions as questionFixtures, reviews as reviewFixtures } from "@/fixtures/reviews";
import { videos as videoFixtures } from "@/fixtures/videos";
import type { Database } from "@/shared/infrastructure/database";
import { comments, notes, questions, reviews, videos, videoStats } from "./schema";

/** Seed content is dated relative to this moment, so "2h ago" stays meaningful. */
const SEEDED_AT = new Date("2026-10-24T12:00:00Z");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2h" / "1d" before the seed moment. */
const ago = (label: string) => {
  const n = Number.parseInt(label, 10) || 1;
  return new Date(SEEDED_AT.getTime() - n * (label.endsWith("d") ? 86_400_000 : 3_600_000));
};
/** "Oct 12" in 2026. */
const day = (label: string) => {
  const [mon, d] = label.split(" ");
  return new Date(Date.UTC(2026, MONTHS.indexOf(mon), Number(d), 9));
};

/** Loads the design-phase videos, comments, notes, reviews and Q&A. Skips when videos already exist. */
export async function seedContent(db: Database) {
  const [{ value }] = await db.select({ value: count() }).from(videos);
  if (value > 0) return { skipped: true };
  const productBySlug = new Map(productFixtures.map((p) => [p.slug, p]));

  await db.transaction(async (tx) => {
    // Feed order in the fixtures is the curated order: the first video is the newest.
    const videoRows = videoFixtures.map((v, i) => {
      const at = new Date(SEEDED_AT.getTime() - i * 3_600_000);
      return {
        id: v.id,
        authorId: null,
        sellerId: v.sellerId,
        productSlug: v.productSlug,
        alsoSlugs: v.also ?? [],
        category: productBySlug.get(v.productSlug)?.category ?? "other",
        spots: v.spots ?? [],
        posterUrl: v.image,
        renditions: v.clip ? [{ height: 720, url: v.clip, bitrateKbps: 2000 }] : [],
        sourceKey: null,
        durationMs: null,
        tone: v.tone,
        caption: v.caption,
        tags: v.tags,
        place: v.place,
        status: "ready" as const,
        createdAt: at,
        publishedAt: at,
      };
    });
    await tx.insert(videos).values(videoRows);
    await tx.insert(videoStats).values(videoFixtures.map((v) => ({ videoId: v.id, likes: v.likes, comments: v.comments, saves: v.saves, shares: v.shares, views: v.likes * 14 })));
    const commentRows = videoFixtures.flatMap((v) =>
      v.topComments.map((c, i) => ({
        id: `${v.id}-c${i + 1}`,
        targetType: "video" as const,
        targetId: v.id,
        authorId: null,
        authorName: c.name,
        authorAvatar: c.avatar,
        text: c.text,
        likes: c.likes,
        bySeller: c.seller ?? false,
        createdAt: ago(c.ago),
      })),
    );
    if (commentRows.length) await tx.insert(comments).values(commentRows);

    await tx.insert(notes).values(
      noteFixtures.map((n, i) => ({
        id: n.id,
        authorId: null,
        authorName: n.authorName,
        authorAvatar: n.authorAvatar,
        title: n.title,
        imageUrl: n.image,
        ratio: n.ratio,
        productSlug: n.productSlug ?? null,
        category: n.category,
        live: n.live ?? false,
        video: n.video ?? false,
        likes: n.likes,
        createdAt: new Date(SEEDED_AT.getTime() - i * 2 * 3_600_000),
      })),
    );

    await tx.insert(reviews).values(
      reviewFixtures.map((r) => ({
        id: r.id,
        productSlug: r.productSlug,
        sellerId: productBySlug.get(r.productSlug)?.sellerId ?? "unknown",
        orderId: null,
        authorId: null,
        authorName: r.author,
        authorAvatar: r.avatar,
        country: r.country,
        rating: r.rating,
        text: r.text,
        translatedFrom: r.translatedFrom ?? null,
        original: r.original ?? null,
        photos: r.photos ?? [],
        option: r.option ?? null,
        helpful: r.helpful,
        sellerReply: r.sellerReply ?? null,
        createdAt: day(r.date),
      })),
    );

    await tx.insert(questions).values(
      questionFixtures.map((q, i) => ({
        id: q.id,
        productSlug: q.productSlug,
        sellerId: productBySlug.get(q.productSlug)?.sellerId ?? null,
        askerId: null,
        askerName: q.asker,
        question: q.question,
        answer: q.answer,
        answeredBy: q.answeredBy,
        votes: q.votes,
        createdAt: new Date(SEEDED_AT.getTime() - (i + 1) * 86_400_000),
      })),
    );
  });

  return { skipped: false, videos: videoFixtures.length, notes: noteFixtures.length, reviews: reviewFixtures.length, questions: questionFixtures.length };
}
