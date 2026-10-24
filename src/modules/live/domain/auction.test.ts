import { describe, expect, it } from "vitest";
import { expectOk as expectOkIn, money, type Result } from "@/shared/kernel";
import { closeLot, minimumBid, openLot, placeBid, SNIPE_WINDOW_MS } from "./auction";

const expectOk = <T, E>(r: Result<T, E>) => expectOkIn(r, "test");
const t0 = new Date("2026-10-24T12:00:00Z");
const later = (ms: number) => new Date(t0.getTime() + ms);
const lot = () => expectOk(openLot({ id: "l1", showId: "s1", slug: "vase", startPrice: money.fromDollars(40), increment: money.fromDollars(2), durationMs: 60_000, at: t0 }));
const kofi = { id: "kofi", name: "kofi_a" };
const mei = { id: "mei", name: "mei_l" };

describe("auction lots", () => {
  it("opens with sane limits", () => {
    expect(openLot({ id: "x", showId: "s", slug: "v", startPrice: 0 as never, increment: money.fromDollars(1), durationMs: 60_000, at: t0 }).ok).toBe(false);
    expect(openLot({ id: "x", showId: "s", slug: "v", startPrice: money.fromDollars(1), increment: money.fromDollars(0.1), durationMs: 60_000, at: t0 }).ok).toBe(false);
    expect(openLot({ id: "x", showId: "s", slug: "v", startPrice: money.fromDollars(1), increment: money.fromDollars(1), durationMs: 5_000, at: t0 }).ok).toBe(false);
  });

  it("takes bids at the start price, then the top bid plus the increment", () => {
    let l = lot();
    expect(placeBid(l, kofi, money.fromDollars(39), later(1000)).ok).toBe(false);
    l = expectOk(placeBid(l, kofi, money.fromDollars(40), later(1000)));
    expect(minimumBid(l)).toBe(money.fromDollars(42));
    expect(placeBid(l, mei, money.fromDollars(41), later(2000)).ok).toBe(false);
    expect(placeBid(l, kofi, money.fromDollars(50), later(2000)).ok).toBe(false); // already on top
    l = expectOk(placeBid(l, mei, money.fromDollars(42), later(2000)));
    expect(l).toMatchObject({ bids: 2, version: 2, topBid: { bidderId: "mei", amount: 4200 } });
  });

  it("pushes the close back when a bid lands in the last seconds", () => {
    const l = expectOk(placeBid(lot(), kofi, money.fromDollars(40), later(55_000)));
    expect(l.endsAt.getTime()).toBe(later(55_000).getTime() + SNIPE_WINDOW_MS);
    const early = expectOk(placeBid(lot(), kofi, money.fromDollars(40), later(10_000)));
    expect(early.endsAt.getTime()).toBe(later(60_000).getTime());
  });

  it("sells to the top bidder when the clock runs out, once", () => {
    const bid = expectOk(placeBid(lot(), kofi, money.fromDollars(40), later(1000)));
    expect(closeLot(bid, later(30_000)).event).toBeNull();
    const { lot: sold, event } = closeLot(bid, later(60_000));
    expect(sold.status).toBe("sold");
    expect(event).toMatchObject({ winnerId: "kofi", amount: 4000, slug: "vase" });
    expect(closeLot(sold, later(90_000)).event).toBeNull();
    expect(placeBid(sold, mei, money.fromDollars(60), later(61_000)).ok).toBe(false);
    expect(closeLot(lot(), later(60_000)).lot.status).toBe("unsold");
  });
});
