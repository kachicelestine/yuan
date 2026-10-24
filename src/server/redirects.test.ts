import { describe, expect, it } from "vitest";
import { safeNext } from "./redirects";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/checkout")).toBe("/checkout");
    expect(safeNext("/pay/abc?updated=1")).toBe("/pay/abc?updated=1");
  });

  it.each(["https://evil.example", "//evil.example", String.raw`/\evil.example`, "javascript:alert(1)", "/\u0000x", undefined, ""])("refuses %s", (v) => {
    expect(safeNext(v)).toBe("/");
  });
});
