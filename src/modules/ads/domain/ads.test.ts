import { describe, expect, it } from "vitest";
import { cents } from "@/shared/kernel/money";
import { auction, createCampaign, editCampaign, quality, shouldServe, type Candidate } from "./ads";

const at = new Date("2026-10-24T10:00:00Z");
const c = (id: string, sellerId: string, bid: number, q = 1): Candidate => ({ campaignId: id, sellerId, slug: `${id}-p`, bid: cents(bid), quality: q });

describe("the ad auction", () => {
  it("ranks by bid times quality and charges just enough to keep the place", () => {
    const wins = auction([c("a", "s1", 100), c("b", "s2", 60), c("c", "s3", 40)], 2);
    expect(wins.map((w) => w.campaignId)).toEqual(["a", "b"]);
    expect(wins.map((w) => w.price)).toEqual([61, 41]);
  });

  it("lets a much more clicked ad beat a higher bid, and pay less than it bid", () => {
    const wins = auction([c("rich", "s1", 100, 0.5), c("good", "s2", 70, 2)], 1);
    expect(wins[0].campaignId).toBe("good");
    // To stay ahead of 100 × 0.5 = 50 with quality 2, 26¢ is enough.
    expect(wins[0].price).toBe(26);
  });

  it("gives one slot per shop and charges the reserve when nobody is below", () => {
    const wins = auction([c("a", "s1", 100), c("a2", "s1", 90), c("b", "s2", 30)], 3);
    expect(wins.map((w) => w.campaignId)).toEqual(["a", "b"]);
    expect(wins[1].price).toBe(5);
  });

  it("never charges more than the bid", () => {
    const [w] = auction([c("a", "s1", 20, 0.3), c("b", "s2", 19, 3)], 1);
    expect(w.price).toBeLessThanOrEqual(w.bid);
  });
});

describe("ad rules", () => {
  it("smooths quality so new ads start at 1 and good ones earn more", () => {
    expect(quality(0, 0)).toBe(1);
    expect(quality(1000, 60)).toBeGreaterThan(1.5);
    expect(quality(1000, 0)).toBeLessThan(0.5);
  });

  it("spreads the budget over the day", () => {
    expect(shouldServe(cents(1000), cents(1000), 0.5, 0)).toBe(false);
    expect(shouldServe(cents(300), cents(1000), 0.5, 0.99)).toBe(true);
    // 90% spent by 10% of the day: mostly sits out.
    expect(shouldServe(cents(900), cents(1000), 0.1, 0.5)).toBe(false);
    expect(shouldServe(cents(900), cents(1000), 0.1, 0.05)).toBe(true);
  });

  it("checks bids, budgets and that listings are the shop's own", () => {
    const base = { id: "x", sellerId: "s", name: "Scarves", slugs: ["a"], bid: cents(30), dailyBudget: cents(1000), owned: ["a"], at };
    expect(createCampaign(base).ok).toBe(true);
    expect(createCampaign({ ...base, bid: cents(1) }).ok).toBe(false);
    expect(createCampaign({ ...base, dailyBudget: cents(20) }).ok).toBe(false);
    expect(createCampaign({ ...base, slugs: ["b"] }).ok).toBe(false);
    const made = createCampaign(base);
    if (!made.ok) throw new Error();
    // Pausing a campaign whose listing was since taken down still works.
    expect(editCampaign(made.value, { status: "paused" }, [], at).ok).toBe(true);
  });
});
