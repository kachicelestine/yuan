// Leaderboard vocabulary shared by the rankings screen and the server that computes them.
import type { Product, Seller } from "@/lib/types";

export type Period = "day" | "week" | "month";
export type BoardId = "hot" | "saved" | "rated" | "factories";

export const boards: { id: BoardId; label: string; blurb: string }[] = [
  { id: "hot", label: "Best sellers", blurb: "Most ordered" },
  { id: "saved", label: "Most saved", blurb: "Added to wishlists" },
  { id: "rated", label: "Top rated", blurb: "Highest scores with 50+ reviews" },
  { id: "factories", label: "Rising factories", blurb: "Fastest-growing sales" },
];

export const periods: { id: Period; label: string }[] = [
  { id: "day", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

export const PERIOD_DAYS: Record<Period, number> = { day: 1, week: 7, month: 30 };

export const isBoard = (v: string): v is BoardId => boards.some((b) => b.id === v);
export const isPeriod = (v: string): v is Period => periods.some((p) => p.id === v);

/** Places moved since the window before: positive is up; null means new on the board. */
export type Move = number | null;

export type RankedProduct = { kind: "product"; product: Product; metric: string; detail: string; move: Move };
export type RankedSeller = { kind: "seller"; seller: Seller; cover: string; metric: string; detail: string; move: Move; picks: Product[] };

export type Rankings = {
  rows: (RankedProduct | RankedSeller)[];
  /** Set when the window was quiet and the board was topped up with all-time leaders. */
  note: string | null;
  updatedAt: string;
};
