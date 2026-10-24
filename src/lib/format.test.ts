import { describe, expect, it } from "vitest";
import { compact } from "./format";

describe("compact", () => {
  it("keeps small numbers whole and shortens thousands and millions", () => {
    expect(compact(950)).toBe("950");
    expect(compact(8_900)).toBe("8,900");
    expect(compact(12_400)).toBe("12.4K");
    expect(compact(412_000)).toBe("412K");
    expect(compact(999_499)).toBe("999K");
    expect(compact(999_500)).toBe("1M");
    expect(compact(1_792_000)).toBe("1.8M");
    expect(compact(250_000_000)).toBe("250M");
  });
});
