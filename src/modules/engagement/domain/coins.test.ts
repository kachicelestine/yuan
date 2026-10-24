import { describe, expect, it } from "vitest";
import { checkinReward, checkinState, dayOf } from "./coins";

describe("check-in streaks", () => {
  it("counts consecutive days ending yesterday before today's check-in", () => {
    expect(checkinState(["2026-10-21", "2026-10-22", "2026-10-23"], "2026-10-24")).toEqual({ streak: 3, claimedToday: false });
  });

  it("includes today once checked in", () => {
    expect(checkinState(["2026-10-23", "2026-10-24"], "2026-10-24")).toEqual({ streak: 2, claimedToday: true });
  });

  it("starts again after a missed day", () => {
    expect(checkinState(["2026-10-20", "2026-10-21", "2026-10-23"], "2026-10-24")).toEqual({ streak: 1, claimedToday: false });
    expect(checkinState(["2026-10-21"], "2026-10-24")).toEqual({ streak: 0, claimedToday: false });
  });

  it("runs across month ends", () => {
    expect(checkinState(["2026-10-31", "2026-11-01"], "2026-11-02")).toEqual({ streak: 2, claimedToday: false });
  });

  it("pays more as the streak grows, topping out on day 7", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 30].map(checkinReward)).toEqual([10, 10, 20, 20, 30, 30, 100, 100, 100]);
  });

  it("uses UTC days", () => {
    expect(dayOf(new Date("2026-10-24T23:59:59Z"))).toBe("2026-10-24");
    expect(dayOf(new Date("2026-10-25T00:00:00Z"))).toBe("2026-10-25");
  });
});
