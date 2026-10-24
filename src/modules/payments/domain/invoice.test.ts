import { describe, expect, it } from "vitest";
import { cents } from "@/shared/kernel/money";
import { confirmPayment, expire, formatUnits, openInvoice } from "./invoice";
import { journal, paymentReceived } from "./ledger";

const at = new Date("2026-10-24T10:00:00Z");
const open = () => {
  const r = openInvoice({ id: "i1", orderId: "o1", rail: "usdc-base", amount: cents(8740), payTo: "0xabc", tag: 123, at });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe("invoice", () => {
  it("asks for the total plus a sub-cent tag, for 30 minutes", () => {
    const i = open();
    expect(formatUnits(i.units)).toBe("87.400123");
    expect(i.expiresAt.getTime() - at.getTime()).toBe(30 * 60_000);
    expect(openInvoice({ id: "x", orderId: "o", rail: "usdc-base", amount: cents(100), payTo: "a", tag: 0, at }).ok).toBe(false);
    expect(openInvoice({ id: "x", orderId: "o", rail: "usdc-base", amount: cents(0), payTo: "a", tag: 5, at }).ok).toBe(false);
  });

  it("refuses underpayment, accepts exact or more, and is idempotent", () => {
    const i = open();
    expect(confirmPayment(i, { txHash: "t", units: i.units - BigInt(1), at }).ok).toBe(false);
    const paid = confirmPayment(i, { txHash: "t", units: i.units, at });
    expect(paid.ok && paid.value.invoice.status).toBe("paid");
    expect(paid.ok && paid.value.event?.type).toBe("InvoicePaid");
    const twice = paid.ok ? confirmPayment(paid.value.invoice, { txHash: "t", units: i.units, at }) : null;
    expect(twice?.ok && twice.value.event).toBeNull();
  });

  it("flags payments that land after the window, and expires unpaid ones", () => {
    const i = open();
    const late = confirmPayment(i, { txHash: "t", units: i.units, at: new Date(at.getTime() + 31 * 60_000) });
    expect(late.ok && late.value.invoice.late).toBe(true);
    expect(expire(i, new Date(at.getTime() + 5 * 60_000)).ok && expire(i, new Date(at.getTime() + 5 * 60_000))).toMatchObject({ value: { status: "pending" } });
    const expired = expire(i, new Date(at.getTime() + 31 * 60_000));
    expect(expired.ok && expired.value.status).toBe("expired");
  });
});

describe("ledger", () => {
  it("posts a balanced journal for a payment", () => {
    const j = paymentReceived({ id: "j1", invoiceId: "i1", orderId: "o1", rail: "usdc-base", amount: cents(8740), at });
    expect(j.ok && j.value.entries).toEqual([
      { account: "treasury:usdc-base", amount: 8740 },
      { account: "escrow:o1", amount: -8740 },
    ]);
  });

  it("rejects journals that don't sum to zero", () => {
    expect(journal({ id: "j", reference: "r", memo: "m", at, entries: [{ account: "a", amount: cents(1) }, { account: "b", amount: cents(0) }] }).ok).toBe(false);
  });
});
