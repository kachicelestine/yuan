import { describe, expect, it } from "vitest";
import { cents } from "@/shared/kernel/money";
import { commissionFor, isCode, newCode, setRate, settle, type Creator } from "./affiliate";

const at = new Date("2026-10-24T10:00:00Z");
const creator: Creator = { accountId: "creator-1", code: "k7m2qx9", wallet: null, createdAt: at };
const base = { id: "c1", orderId: "o1", sellerId: "shop", creator, buyerId: "buyer-1", creatorRunsShop: false, base: cents(12_345), rate: 0.1, slugs: ["hoodie"], at };

describe("affiliate rules", () => {
  it("makes readable codes", () => {
    const code = newCode(() => 0.5);
    expect(code).toHaveLength(7);
    expect(isCode(code)).toBe(true);
    expect(isCode("abc1lo0")).toBe(false);
  });

  it("owes the rate on the shop's lines, rounded down to the cent", () => {
    expect(commissionFor(base)).toMatchObject({ amount: 1234, status: "pending", code: "k7m2qx9" });
  });

  it("owes nothing to shops out of the programme, to the buyer themselves, or to the shop's own people", () => {
    expect(commissionFor({ ...base, rate: 0 })).toBeNull();
    expect(commissionFor({ ...base, buyerId: "creator-1" })).toBeNull();
    expect(commissionFor({ ...base, creatorRunsShop: true })).toBeNull();
    expect(commissionFor({ ...base, base: cents(5) })).toBeNull();
  });

  it("settles once: earned on delivery with an event, or void", () => {
    const c = commissionFor(base)!;
    const earned = settle(c, "earned", at);
    expect(earned?.commission.status).toBe("earned");
    expect(earned?.event).toMatchObject({ type: "CommissionEarned", creatorId: "creator-1", amount: 1234 });
    expect(settle(earned!.commission, "void", at)).toBeNull();
    expect(settle(c, "void", at)?.event).toBeNull();
  });

  it("accepts only the offered rates", () => {
    expect(setRate("shop", 0.15, at).ok).toBe(true);
    expect(setRate("shop", 0.5, at).ok).toBe(false);
    expect(setRate("shop", 0.11, at).ok).toBe(false);
  });
});
