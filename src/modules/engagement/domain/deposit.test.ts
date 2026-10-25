import { describe, expect, it } from "vitest";
import { money } from "@/shared/kernel";
import { balanceHold, createOffer, festivalWindow, reserve, type OfferInput } from "./deposit";

const at = new Date("2026-10-25T10:00:00Z");
const fest = festivalWindow(2026);
const input: OfferInput = {
  slug: "power-station-2kwh",
  kind: "presale",
  title: "11.11 pre-sale",
  blurb: "",
  deposit: money.fromDollars(10),
  credit: money.fromDollars(30),
  price: money.fromDollars(599),
  opensAt: new Date(at.getTime() - 60_000),
  closesAt: fest.from,
  balanceFrom: fest.from,
  balanceUntil: fest.until,
  stock: 2,
  perPerson: 1,
};
const make = (patch: Partial<OfferInput> = {}) => createOffer({ id: "o", sellerId: "voltgrid", input: { ...input, ...patch }, at });

describe("deposit offers", () => {
  it("puts the 11.11 balance window on 11 November, Beijing time", () => {
    expect(fest.from.toISOString()).toBe("2026-11-10T16:00:00.000Z");
    expect(fest.until.toISOString()).toBe("2026-11-11T16:00:00.000Z");
  });

  it("keeps amounts and windows sane", () => {
    expect(make().ok).toBe(true);
    expect(make({ deposit: money.fromDollars(600) }).ok).toBe(false); // deposit ≥ price
    expect(make({ credit: money.fromDollars(5) }).ok).toBe(false); // counts for less than paid
    expect(make({ credit: money.fromDollars(60) }).ok).toBe(false); // more than 5x
    expect(make({ closesAt: new Date(fest.from.getTime() + 1) }).ok).toBe(false); // overlaps the balance
    expect(make({ balanceUntil: new Date(fest.from.getTime() + 3_600_000) }).ok).toBe(false); // too short to pay
    // A pre-order's deposit counts for itself, whatever was sent.
    const pre = make({ kind: "preorder", credit: money.fromDollars(30) });
    expect(pre.ok && pre.value.credit).toBe(money.fromDollars(10));
  });

  it("holds the balance price only while its window is open, and only once paid", () => {
    const o = make();
    if (!o.ok) throw new Error();
    const d = reserve({ offer: o.value, id: "d", buyerId: "b", holding: 0, at });
    if (!d.ok) throw new Error();
    const paid = { ...d.value, status: "paid" as const };
    expect(balanceHold(d.value, o.value, new Date(fest.from.getTime() + 1))).toBeNull(); // still pending
    expect(balanceHold(paid, o.value, at)).toBeNull(); // too early
    expect(balanceHold(paid, o.value, new Date(fest.from.getTime() + 1))).toEqual({ price: money.fromDollars(569), qty: 1 });
    expect(balanceHold(paid, o.value, fest.until)).toBeNull(); // window closed
    expect(reserve({ offer: o.value, id: "d2", buyerId: "b", holding: 1, at }).ok).toBe(false); // one per person
    expect(reserve({ offer: { ...o.value, taken: 2 }, id: "d3", buyerId: "c", holding: 0, at }).ok).toBe(false); // sold out
  });
});
