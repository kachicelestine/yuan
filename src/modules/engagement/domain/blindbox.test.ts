import { describe, expect, it } from "vitest";
import { holdBox, isFree, makeCase, odds, shakeHint, validSeries, type Series } from "./blindbox";

const regulars = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
const series: Series = {
  id: "s",
  sellerId: "pals",
  slug: "box",
  title: "Night Market",
  poster: "p",
  figures: [...regulars.map((id) => ({ id, name: id, image: id, secret: false })), { id: "secret", name: "Secret", image: "s", secret: true }],
  secretOdds: 144,
  shakesPerCase: 3,
  active: true,
  createdAt: new Date(0),
};
const at = new Date("2026-10-25T10:00:00Z");

// A seeded generator, so the statistics are repeatable.
function seeded(seed: number) {
  return () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
}

describe("blind-box cases", () => {
  it("holds every regular figure once, or the secret in place of one", () => {
    const random = seeded(7);
    for (let n = 0; n < 200; n++) {
      const c = makeCase(series, `c${n}`, n + 1, random, at);
      expect(c.boxes).toHaveLength(12);
      const secrets = c.boxes.filter((b) => b === "secret").length;
      expect(secrets).toBeLessThanOrEqual(1);
      expect(new Set(c.boxes).size).toBe(12);
      expect(c.boxes.filter((b) => b !== "secret").every((b) => regulars.includes(b))).toBe(true);
    }
  });

  it("puts the secret in about one box in secretOdds", () => {
    const random = seeded(42);
    let secrets = 0;
    const cases = 6000;
    for (let n = 0; n < cases; n++) if (makeCase(series, "c", n, random, at).boxes.includes("secret")) secrets++;
    // One in 12 cases: 500 expected; allow generous noise.
    expect(secrets).toBeGreaterThan(400);
    expect(secrets).toBeLessThan(600);
    expect(odds(series).secret).toBeCloseTo(1 / 144);
    expect(odds(series).regular * 12 + odds(series).secret).toBeCloseTo(1);
  });

  it("rules out only figures the box doesn't hold, and never the secret", () => {
    const random = seeded(3);
    const ruled: string[] = [];
    for (let i = 0; i < 11; i++) {
      const hint = shakeHint(series, "c", ruled, random)!;
      expect(hint).not.toBe("c");
      expect(hint).not.toBe("secret");
      expect(ruled).not.toContain(hint);
      ruled.push(hint);
    }
    expect(shakeHint(series, "c", ruled, random)).toBeNull();
  });

  it("holds a free box, refuses a taken one, and frees holds that ran out", () => {
    const base = { caseId: "c", index: 3, size: 12, buyerId: "me", heldByBuyer: 0, at };
    const mine = holdBox({ ...base, current: undefined });
    expect(mine.ok).toBe(true);
    const theirs = { caseId: "c", index: 3, buyerId: "them", state: "held" as const, heldUntil: new Date(at.getTime() + 60_000), orderId: null, openedAt: null, at };
    expect(holdBox({ ...base, current: theirs }).ok).toBe(false);
    expect(isFree(theirs, new Date(at.getTime() + 120_000))).toBe(true);
    expect(holdBox({ ...base, current: { ...theirs, state: "sold" } }).ok).toBe(false);
    expect(holdBox({ ...base, index: 12, current: undefined }).ok).toBe(false);
    expect(holdBox({ ...base, heldByBuyer: 3, current: undefined }).ok).toBe(false);
  });

  it("checks a series makes sense", () => {
    expect(validSeries(series).ok).toBe(true);
    expect(validSeries({ ...series, secretOdds: 5 }).ok).toBe(false);
    expect(validSeries({ ...series, figures: series.figures.slice(0, 1) }).ok).toBe(false);
  });
});
