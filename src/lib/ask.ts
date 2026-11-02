// What the Ask assistant sends the screen: progress while it works, then blocks to show.
import type { Product } from "./types";

export type AskAction =
  | { type: "add-to-bag"; lines: { slug: string; title: string; image: string; unitPrice: number; qty: number }[] }
  | { type: "watch"; slug: string; title: string; target: number; intoBag: boolean }
  | { type: "rfq"; item: string; qty: number; details: string };

export type AskBlock =
  | { kind: "text"; text: string }
  | { kind: "products"; products: Product[] }
  | { kind: "compare"; products: Product[]; rows: { label: string; values: string[]; best?: number }[] }
  | { kind: "landed"; title: string; qty: number; country: string; item: number; shipping: number; duty: number; vat: number; total: number }
  | { kind: "action"; id: string; label: string; detail: string; action: AskAction };

/** One line of the response stream (newline-delimited JSON). */
export type AskEvent = { type: "step"; text: string } | { type: "blocks"; blocks: AskBlock[] } | { type: "error"; message: string } | { type: "done" };

/** A turn kept for context: what the shopper asked and what the assistant said. The latest question may carry a photo (JPEG, base64). */
export type AskTurn = { role: "user" | "assistant"; text: string; photo?: string };

export const askSuggestions = [
  "Power my 2-bedroom flat through blackouts",
  "Compare the mini drone and the projector",
  "Duties on 20 hoodies to my country?",
  "Tell me if the power station drops under $540",
  "Get quotes for 300 custom tote bags",
];
