import { describe, expect, it } from "vitest";
import { EXPLORE_UNDER_VIEWS, rankFeed, score, type Candidate } from "./ranking";

const now = new Date("2026-10-24T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const video = (id: string, views: number, likes: number, age = 1): Candidate => ({
  id,
  publishedAt: hoursAgo(age),
  stats: { views, likes, comments: 0, saves: 0, shares: 0 },
});

describe("feed ranking", () => {
  it("prefers more engagement per view", () => {
    expect(score(video("a", 10_000, 2_000), now)).toBeGreaterThan(score(video("b", 10_000, 200), now));
  });

  it("doesn't let a handful of views outrank a proven video", () => {
    // 2 likes from 3 views is a 67% rate, but 3 views prove nothing yet.
    expect(score(video("lucky", 3, 2), now)).toBeLessThan(score(video("proven", 30_000, 6_000), now));
  });

  it("lets older videos fade", () => {
    expect(score(video("new", 5_000, 500, 1), now)).toBeGreaterThan(score(video("old", 5_000, 500, 24 * 7), now));
  });

  it("weighs shares and comments above likes", () => {
    const base = video("x", 5_000, 100);
    const shared: Candidate = { ...base, id: "s", stats: { ...base.stats, shares: 50 } };
    const liked: Candidate = { ...base, id: "l", stats: { ...base.stats, likes: 150 } };
    expect(score(shared, now)).toBeGreaterThan(score(liked, now));
  });

  it("gives every fourth slot to the newest unproven video", () => {
    const proven = ["p1", "p2", "p3", "p4", "p5", "p6"].map((id, i) => video(id, 50_000, 10_000 - i * 1_000, 2));
    const fresh = [video("f-old", 10, 0, 5), video("f-new", 10, 0, 1)];
    const order = rankFeed([...proven, ...fresh], now);
    expect(order).toHaveLength(8);
    expect(order[3]).toBe("f-new");
    expect(order[7]).toBe("f-old");
    expect(order.slice(0, 3)).toEqual(["p1", "p2", "p3"]);
    expect(fresh.every((f) => f.stats.views < EXPLORE_UNDER_VIEWS)).toBe(true);
  });

  it("places each video once and is stable", () => {
    const list = Array.from({ length: 30 }, (_, i) => video(`v${i}`, (i * 37) % 900, (i * 13) % 80, i % 9));
    const a = rankFeed(list, now);
    expect(new Set(a).size).toBe(30);
    expect(rankFeed([...list].reverse(), now)).toEqual(a);
  });
});
