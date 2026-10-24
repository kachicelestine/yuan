import type { Market } from "./types";

export type Landed = { item: number; shipping: number; duty: number; vat: number; total: number };

/** The price at the door, in USD: item, shipping, import duty, then VAT on all three. */
export function landedCost(item: number, dutyRate: number, market: Market, shippingOverride?: number): Landed {
  const shipping = shippingOverride ?? (item >= market.freeShippingOver || item === 0 ? 0 : market.shipping);
  const duty = item * dutyRate;
  const vat = (item + shipping + duty) * market.vat;
  return { item, shipping, duty, vat, total: item + shipping + duty + vat };
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Moves a "Nov 4–9" style window later by `days`; other formats ("6–8 weeks") pass through. */
export function shiftDelivery(window: string, days: number) {
  const match = /^([A-Z][a-z]{2}) (\d+)–(?:([A-Z][a-z]{2}) )?(\d+)$/.exec(window);
  if (!match || days === 0) return window;
  const [, m1, d1, m2, d2] = match;
  const shift = (month: string, day: string) => {
    const date = new Date(Date.UTC(2026, months.indexOf(month), Number(day) + days));
    return { month: months[date.getUTCMonth()], day: date.getUTCDate() };
  };
  const a = shift(m1, d1);
  const b = shift(m2 ?? m1, d2);
  return a.month === b.month ? `${a.month} ${a.day}–${b.day}` : `${a.month} ${a.day}–${b.month} ${b.day}`;
}

