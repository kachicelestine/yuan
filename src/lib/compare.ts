// Side-by-side comparison: which product wins each row, and an overall pick.
import { getSeller, getSellerProfile, unitPrice } from "@/lib/catalog";
import { landedCost, shiftDelivery } from "@/lib/landed";
import { daysToDelivery } from "@/lib/search";
import type { Market, Product } from "@/lib/types";

export const compareLimit = 3;

type Cell = { text: string; score?: number };
export type CompareRow = { label: string; group: "Price" | "Quality" | "Delivery" | "Seller" | "Specs"; cells: Cell[]; best?: number; lowerWins?: boolean };

/** Index of the winning cell, or undefined on a tie or when only one product has a value. */
function winner(cells: Cell[], lowerWins: boolean) {
  const scored = cells.map((c, i) => [c.score, i] as const).filter(([s]) => s !== undefined && Number.isFinite(s)) as [number, number][];
  if (scored.length < 2) return undefined;
  const sorted = [...scored].sort((a, b) => (lowerWins ? a[0] - b[0] : b[0] - a[0]));
  return sorted[0][0] === sorted[1][0] ? undefined : sorted[0][1];
}

export function compareRows(items: Product[], market: Market, money: (usd: number) => string): CompareRow[] {
  const row = (label: string, group: CompareRow["group"], cells: Cell[], lowerWins = false): CompareRow => ({ label, group, cells, lowerWins, best: winner(cells, lowerWins) });
  const profiles = items.map((p) => getSellerProfile(p.sellerId));
  const sellers = items.map((p) => getSeller(p.sellerId));

  const rows: CompareRow[] = [
    row("Price", "Price", items.map((p) => (p.price === undefined ? { text: "Quote" } : { text: money(unitPrice(p, p.moq ?? 1)), score: unitPrice(p, p.moq ?? 1) })), true),
    row(
      `Delivered to ${market.city}`,
      "Price",
      items.map((p) => {
        if (p.price === undefined) return { text: "Ask for a quote" };
        const total = landedCost(unitPrice(p, p.moq ?? 1) * (p.moq ?? 1), p.dutyRate, market).total / (p.moq ?? 1);
        return { text: `${money(total)} each`, score: total };
      }),
      true,
    ),
    row(
      "Bulk price",
      "Price",
      items.map((p) => {
        const top = p.tiers?.at(-1);
        return top ? { text: `${money(top.price)} at ${top.min}+`, score: top.price } : { text: "—" };
      }),
      true,
    ),
    row("Rating", "Quality", items.map((p) => ({ text: `★ ${p.rating}`, score: p.rating }))),
    row("Reviews", "Quality", items.map((p) => ({ text: p.reviews.toLocaleString("en-US"), score: p.reviews }))),
    row("Sold", "Quality", items.map((p) => (p.sold ? { text: p.sold.toLocaleString("en-US"), score: p.sold } : { text: "—" }))),
    row(
      "Arrives",
      "Delivery",
      items.map((p) => {
        const days = daysToDelivery(p);
        return { text: shiftDelivery(p.delivery, market.extraDays), score: Number.isFinite(days) ? days + market.extraDays : undefined };
      }),
      true,
    ),
    row("Ships from", "Delivery", items.map((p) => ({ text: p.shipsFrom }))),
    row("Min order", "Delivery", items.map((p) => ({ text: p.moq ? `${p.moq} pcs` : "1 piece", score: p.moq ?? 1 })), true),
    row("Seller", "Seller", sellers.map((s) => ({ text: s ? `${s.name}${s.verified ? " ✓" : ""}` : "—" }))),
    row("Seller rating", "Seller", profiles.map((pr) => (pr ? { text: `★ ${pr.rating}`, score: pr.rating } : { text: "—" }))),
    row("Replies in", "Seller", profiles.map((pr) => (pr ? { text: pr.responseHours < 1 ? `${Math.round(pr.responseHours * 60)} min` : `${pr.responseHours} h`, score: pr.responseHours } : { text: "—" })), true),
    row("On-time shipping", "Seller", profiles.map((pr) => (pr ? { text: `${Math.round(pr.onTime * 100)}%`, score: pr.onTime } : { text: "—" }))),
  ];

  // Specs every product shares come first; the rest still show, with a dash where a listing is silent.
  const keys = [...new Set(items.flatMap((p) => p.specs.map(([k]) => k)))];
  const shared = (k: string) => items.filter((p) => p.specs.some(([key]) => key === k)).length;
  keys.sort((a, b) => shared(b) - shared(a));
  for (const k of keys.slice(0, 10)) {
    rows.push(row(k, "Specs", items.map((p) => ({ text: p.specs.find(([key]) => key === k)?.[1] ?? "—" }))));
  }
  return rows;
}

/** The product that wins the most rows, with the reasons that matter most to a shopper. */
export function verdict(items: Product[], rows: CompareRow[]) {
  if (items.length < 2) return null;
  const wins = items.map(() => [] as string[]);
  for (const r of rows) if (r.best !== undefined) wins[r.best].push(r.label);
  const top = wins.reduce((best, w, i) => (w.length > wins[best].length ? i : best), 0);
  const reasons = wins[top].slice(0, 3).map((l) => l.replace(/^Delivered to .*/, "cheapest delivered").toLowerCase());
  return { product: items[top], wins: wins[top].length, of: rows.filter((r) => r.best !== undefined).length, reasons };
}
