import { randomBytes } from "node:crypto";
import { count } from "drizzle-orm";
import { auctionRoom, liveReplays, liveRooms, liveSchedule } from "@/fixtures/live";
import { products as productFixtures } from "@/fixtures/products";
import type { Database } from "@/shared/infrastructure/database";
import { money } from "@/shared/kernel";
import { chatMessages, lots, shows } from "./schema";

/** Seed shows are dated relative to this moment, like the rest of the seed data. */
const SEEDED_AT = new Date("2026-10-24T12:00:00Z");
/** Seed hosts and chat authors aren't real accounts. */
const NOBODY = "00000000-0000-0000-0000-000000000000";
const key = () => randomBytes(24).toString("base64url");
const at = (hours: number) => new Date(SEEDED_AT.getTime() + hours * 3_600_000);

/** The design-phase rooms, schedule and replays as real shows. Skips when shows exist. */
export async function seedLive(db: Database) {
  const [{ value }] = await db.select({ value: count() }).from(shows);
  if (value > 0) return { skipped: true };
  const auctionSlugs = productFixtures.filter((p) => p.sellerId === auctionRoom.sellerId && p.slug.startsWith("vase-")).map((p) => p.slug);

  await db.transaction(async (tx) => {
    const base = { hostAccountId: NOBODY, place: "", pinned: null, startedAt: null, endedAt: null, peakViewers: 0 };
    await tx.insert(shows).values([
      ...liveRooms.map((r, i) => ({
        ...base,
        id: r.id,
        sellerId: r.sellerId,
        hostName: r.hostName,
        title: r.title,
        kind: r.kind,
        coverUrl: r.image,
        place: r.place,
        status: "live" as const,
        scheduledFor: at(-1 - i * 0.25),
        startedAt: at(-0.5 - i * 0.25),
        streamKey: key(),
        items: r.items.map((it) => ({ slug: it.slug, status: it.status, livePriceCents: money.fromDollars(it.livePrice) })),
        pinned: r.pinned,
        peakViewers: r.viewers,
      })),
      {
        ...base,
        id: "auction",
        sellerId: auctionRoom.sellerId,
        hostName: auctionRoom.hostName,
        title: "Porcelain auction: hand-painted vases",
        kind: "auction" as const,
        coverUrl: auctionRoom.image,
        place: "Jingdezhen kilns",
        status: "live" as const,
        scheduledFor: at(-1),
        startedAt: at(-0.75),
        streamKey: key(),
        items: auctionSlugs.map((slug, i) => ({ slug, status: i === 0 ? ("on-air" as const) : ("next" as const), livePriceCents: null })),
        peakViewers: 2140,
      },
      ...liveSchedule.map((s) => ({
        ...base,
        id: s.id,
        sellerId: s.sellerId,
        hostName: s.hostName,
        title: s.title,
        kind: s.kind,
        coverUrl: s.image,
        status: "scheduled" as const,
        scheduledFor: at(s.inHours),
        streamKey: key(),
        items: [],
      })),
      ...liveReplays.map((r) => ({
        ...base,
        id: `replay-${r.id}`,
        sellerId: r.sellerId,
        hostName: "",
        title: r.title,
        kind: "show" as const,
        coverUrl: r.image,
        status: "ended" as const,
        scheduledFor: at(-48),
        startedAt: at(-48),
        endedAt: at(-48 + r.minutes / 60),
        streamKey: "",
        items: [],
        peakViewers: r.views,
      })),
    ]);

    const messages = liveRooms.flatMap((r, i) =>
      r.comments.map((c, j) => ({ id: crypto.randomUUID(), showId: r.id, authorId: NOBODY, authorName: c.name, text: c.text, host: c.host ?? false, at: new Date(at(-0.5 - i * 0.25).getTime() + j * 60_000) })),
    );
    if (messages.length) await tx.insert(chatMessages).values(messages);

    // A demo lot that stays open for a day, so the auction room has something to bid on.
    if (auctionSlugs[0]) {
      await tx.insert(lots).values({ id: crypto.randomUUID(), showId: "auction", slug: auctionSlugs[0], startPriceCents: 4000, incrementCents: 200, endsAt: at(24), status: "open", topBid: null, bids: 0, version: 0 });
    }
  });
  return { skipped: false, live: liveRooms.length + 1, scheduled: liveSchedule.length, replays: liveReplays.length };
}
