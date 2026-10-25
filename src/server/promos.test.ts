import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./container", () => ({ services: async () => ({}) }));

describe("festivalStart", async () => {
  const { festivalStart, festivalKey } = await import("./promos");

  it("is 11 November at midnight in Beijing", () => {
    expect(festivalStart(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe("2026-11-10T16:00:00.000Z");
    expect(festivalKey(festivalStart(new Date("2026-10-24T10:00:00Z")))).toBe("festival:2026-11-10");
  });

  it("stays on today's festival while it runs, then moves to next year", () => {
    expect(festivalStart(new Date("2026-11-11T08:00:00Z")).toISOString()).toBe("2026-11-10T16:00:00.000Z");
    expect(festivalStart(new Date("2026-11-12T08:00:00Z")).toISOString()).toBe("2027-11-10T16:00:00.000Z");
  });
});
