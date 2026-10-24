import { describe, expect, it } from "vitest";
import { ago, shortDate, toVideoView } from "./views";

const now = new Date("2026-10-24T12:00:00Z");
const before = (ms: number) => new Date(now.getTime() - ms);

describe("content views", () => {
  it("says how long ago, compactly", () => {
    expect(ago(before(20_000), now)).toBe("now");
    expect(ago(before(5 * 60_000), now)).toBe("5m");
    expect(ago(before(2 * 3_600_000), now)).toBe("2h");
    expect(ago(before(3 * 86_400_000), now)).toBe("3d");
    expect(ago(before(20 * 86_400_000), now)).toBe("2w");
  });

  it("dates reviews the same on every server", () => {
    expect(shortDate(new Date("2026-10-12T23:30:00Z"))).toBe("Oct 12");
  });

  it("plays 720p on phones and keeps every size for players that choose", () => {
    const view = toVideoView(
      {
        id: "v",
        authorId: null,
        sellerId: "s",
        productSlug: "p",
        alsoSlugs: [],
        category: "home",
        spots: [],
        posterUrl: "poster.jpg",
        renditions: [
          { height: 480, url: "480.mp4", bitrateKbps: 900 },
          { height: 720, url: "720.mp4", bitrateKbps: 2000 },
          { height: 1080, url: "1080.mp4", bitrateKbps: 4500 },
        ],
        sourceKey: null,
        durationMs: 12_000,
        tone: "dark",
        caption: "hi",
        tags: [],
        place: "",
        status: "ready",
        createdAt: now,
        publishedAt: now,
      },
      undefined,
      [],
      now,
    );
    expect(view.clip).toBe("720.mp4");
    expect(view.renditions).toHaveLength(3);
    expect(view.likes).toBe(0);
    expect(view).not.toHaveProperty("also");
  });
});
