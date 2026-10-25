import { describe, expect, it } from "vitest";
import { canSee, createBoard, MAX_BOARD_ITEMS, MAX_BOARDS, toggleItem, type Board } from "./board";

const at = new Date("2026-10-24T10:00:00Z");
const owner = { accountId: "a", name: "shopper-aaaaaa" };
const make = (name = "Trip", existing = 0) => createBoard({ id: "abcdefgh", owner, name, isPublic: true, existing, at });

describe("boards", () => {
  it("needs a name and caps how many boards one person has", () => {
    expect(make("  ").ok).toBe(false);
    expect(make("x".repeat(61)).ok).toBe(false);
    expect(make("Trip", MAX_BOARDS).ok).toBe(false);
    expect(make("Trip", MAX_BOARDS - 1).ok).toBe(true);
  });

  it("adds to the front, ignores repeats and caps the items", () => {
    const b = make();
    if (!b.ok) throw new Error();
    const one = toggleItem(b.value, "x", true, at);
    const two = one.ok ? toggleItem(one.value, "y", true, at) : one;
    expect(two.ok && two.value.slugs).toEqual(["y", "x"]);
    expect(two.ok && toggleItem(two.value, "y", true, at).ok && two.value.slugs.length).toBe(2);
    const full: Board = { ...b.value, slugs: Array.from({ length: MAX_BOARD_ITEMS }, (_, i) => `s${i}`) };
    expect(toggleItem(full, "new", true, at).ok).toBe(false);
    expect(toggleItem(full, "s0", false, at).ok).toBe(true);
  });

  it("shows a private board only to its owner", () => {
    const b = createBoard({ id: "abcdefgh", owner, name: "Gifts", isPublic: false, existing: 0, at });
    if (!b.ok) throw new Error();
    expect(canSee(b.value, "a")).toBe(true);
    expect(canSee(b.value, "b")).toBe(false);
    expect(canSee(b.value, null)).toBe(false);
  });
});
