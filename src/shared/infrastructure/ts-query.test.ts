import { describe, expect, it } from "vitest";
import { toTsQuery } from "./ts-query";

describe("toTsQuery", () => {
  it("requires every word and lets the last one match as a prefix", () => {
    expect(toTsQuery("solar pan")).toBe("(solar) & (pan:*)");
  });

  it("drops filler words and returns null when nothing is left", () => {
    expect(toTsQuery("show me the best hoodie")).toBe("(hoodie:*)");
    expect(toTsQuery("please show me")).toBeNull();
    expect(toTsQuery("  ")).toBeNull();
  });

  it("widens words with synonyms, including from plural forms", () => {
    expect(toTsQuery("batteries for camping", { battery: ["lifepo4", "power station"] })).toBe("(batteries | batterie | battery | lifepo4 | power <-> station) & (camping:*)");
  });

  it("keeps only safe characters, whatever the input", () => {
    const q = toTsQuery("panel'); drop table x; -- & | !:*")!;
    expect(q).toMatch(/^[a-z0-9 ()&|:*<>-]+$/);
    expect(q).not.toContain("'");
  });
});
