import { describe, expect, it } from "vitest";
import { leadTimeFrom } from "../infrastructure/seed";
import { formatDeliveryWindow } from "./views";

const oct23 = new Date("2026-10-23T15:00:00Z");

describe("formatDeliveryWindow", () => {
  it("shows a date range within one month", () => {
    expect(formatDeliveryWindow({ minDays: 12, maxDays: 17 }, oct23)).toBe("Nov 4–9");
  });

  it("names both months when the window crosses one", () => {
    expect(formatDeliveryWindow({ minDays: 7, maxDays: 11 }, oct23)).toBe("Oct 30–Nov 3");
  });

  it("switches to weeks once the earliest date is six weeks out", () => {
    expect(formatDeliveryWindow({ minDays: 42, maxDays: 56 }, oct23)).toBe("6–8 weeks");
    expect(formatDeliveryWindow({ minDays: 28, maxDays: 36 }, oct23)).toBe("Nov 20–28");
  });

  it("round-trips the fixture windows it was seeded from", () => {
    for (const w of ["Nov 4–9", "Oct 30–Nov 3", "Nov 20–28", "6–8 weeks"]) {
      expect(formatDeliveryWindow(leadTimeFrom(w), oct23)).toBe(w);
    }
  });
});
