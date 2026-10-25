import { domainError, err, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// Wholesale sourcing: a buyer describes what they need and how many; it goes to the shops
// whose listings match; each shop may answer with one quote, tied to one of its listings
// (price per unit, minimum order, lead time, sample price). Accepting a quote holds that
// price for the buyer for a week, for between the minimum and the quantity asked (or the
// minimum, if higher); checkout honours it and paying uses it up. Delivery terms are what
// the buyer asks the shop to price in; checkout still adds shipping and duties as usual.

export const INCOTERMS = ["FOB", "CIF", "DDP"] as const;
export type Incoterm = (typeof INCOTERMS)[number];

/** Days a request stays open for quotes. */
export const RFQ_DAYS = 14;
/** Days an accepted quote's price is held. */
export const HOLD_DAYS = 7;
/** Shops one request goes to. */
export const MAX_SHOPS = 8;
export const MAX_QTY = 10_000;
/** Open requests one buyer may have at once. */
export const MAX_OPEN = 10;

const DAY = 86_400_000;

export type RfqStatus = "open" | "ordered" | "closed";

export type Rfq = Readonly<{
  id: string;
  buyerId: string;
  buyerName: string;
  item: string;
  details: string;
  /** The listing it's about, when asked from a product page. */
  slug: string | null;
  qty: number;
  /** What the buyer hopes to pay per unit, if they said. */
  target: Cents | null;
  port: string;
  incoterm: Incoterm;
  samples: boolean;
  /** The shops it was sent to. */
  sellerIds: readonly string[];
  status: RfqStatus;
  createdAt: Date;
  closesAt: Date;
}>;

export type QuoteStatus = "offered" | "accepted" | "withdrawn" | "declined";

export type Quote = Readonly<{
  id: string;
  rfqId: string;
  sellerId: string;
  /** The shop's listing this quote is for. */
  slug: string;
  unitPrice: Cents;
  moq: number;
  leadDays: number;
  /** Price of a sample, if the shop sends one. */
  sample: Cents | null;
  note: string;
  status: QuoteStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Accepted quotes: the price is held until then, unless used. */
  holdUntil: Date | null;
  usedAt: Date | null;
}>;

export type RfqOpened = Readonly<{ type: "RfqOpened"; rfqId: string; sellerIds: readonly string[]; item: string; qty: number; at: Date }>;
export type QuoteOffered = Readonly<{ type: "QuoteOffered"; rfqId: string; quoteId: string; buyerId: string; sellerId: string; item: string; updated: boolean; at: Date }>;
export type QuoteAccepted = Readonly<{ type: "QuoteAccepted"; rfqId: string; quoteId: string; buyerId: string; sellerId: string; slug: string; item: string; at: Date }>;

export type SourcingError = DomainError<"invalid_request" | "no_shops" | "too_many" | "closed" | "not_found" | "forbidden" | "invalid_quote">;

const clean = (s: string) => s.trim().replace(/\s+/g, " ");
const invalid = (message: string) => err(domainError("invalid_request", message));
const badQuote = (message: string) => err(domainError("invalid_quote", message));

export type RfqInput = { item: string; details: string; slug: string | null; qty: number; target: Cents | null; port: string; incoterm: string; samples: boolean };

export function openRfq(p: { id: string; buyer: { accountId: string; name: string }; input: RfqInput; sellerIds: readonly string[]; openCount: number; at: Date }): Result<{ rfq: Rfq; event: RfqOpened }, SourcingError> {
  const item = clean(p.input.item);
  const details = p.input.details.trim();
  if (item.length < 3 || item.length > 200) return invalid("Say what you need in a few words (up to 200 characters).");
  if (details.length > 1000) return invalid("Keep the details under 1,000 characters.");
  if (!Number.isInteger(p.input.qty) || p.input.qty < 1 || p.input.qty > MAX_QTY) return invalid(`Ask for 1 to ${MAX_QTY.toLocaleString("en-US")} units.`);
  if (p.input.target !== null && (!Number.isInteger(p.input.target) || p.input.target < 1 || p.input.target > 100_000_000)) return invalid("The target price doesn't look right.");
  const port = clean(p.input.port);
  if (port.length < 2 || port.length > 80) return invalid("Say where it should be delivered.");
  if (!(INCOTERMS as readonly string[]).includes(p.input.incoterm)) return invalid("Pick FOB, CIF or DDP.");
  if (p.openCount >= MAX_OPEN) return err(domainError("too_many", `You can have ${MAX_OPEN} open requests at once. Close one you don't need.`));
  const sellerIds = [...new Set(p.sellerIds)].slice(0, MAX_SHOPS);
  if (!sellerIds.length) return err(domainError("no_shops", "No shop sells anything like that yet. Try plainer words, like “solar panels” or “tote bags”."));
  const rfq: Rfq = {
    id: p.id,
    buyerId: p.buyer.accountId,
    buyerName: p.buyer.name,
    item,
    details,
    slug: p.input.slug,
    qty: p.input.qty,
    target: p.input.target,
    port,
    incoterm: p.input.incoterm as Incoterm,
    samples: p.input.samples,
    sellerIds,
    status: "open",
    createdAt: p.at,
    closesAt: new Date(p.at.getTime() + RFQ_DAYS * DAY),
  };
  return ok({ rfq, event: { type: "RfqOpened", rfqId: rfq.id, sellerIds, item, qty: rfq.qty, at: p.at } });
}

export const isOpen = (r: Rfq, now: Date) => r.status === "open" && now < r.closesAt;

export type QuoteInput = { slug: string; unitPrice: Cents; moq: number; leadDays: number; sample: Cents | null; note: string };

/** A shop's quote, new or revised (a revision keeps its id while it's still on offer). */
export function offerQuote(p: { rfq: Rfq; sellerId: string; existing: Quote | null; id: string; input: QuoteInput; at: Date }): Result<{ quote: Quote; event: QuoteOffered }, SourcingError> {
  const { rfq, input } = p;
  if (!rfq.sellerIds.includes(p.sellerId)) return err(domainError("not_found", "No such request."));
  if (!isOpen(rfq, p.at)) return err(domainError("closed", "This request is no longer taking quotes."));
  if (p.existing && p.existing.status !== "offered" && p.existing.status !== "withdrawn") return err(domainError("closed", "Your quote can't be changed any more."));
  if (!Number.isInteger(input.unitPrice) || input.unitPrice < 1 || input.unitPrice > 100_000_000) return badQuote("Give a price per unit.");
  if (!Number.isInteger(input.moq) || input.moq < 1 || input.moq > MAX_QTY) return badQuote(`The minimum order must be 1 to ${MAX_QTY.toLocaleString("en-US")}.`);
  if (!Number.isInteger(input.leadDays) || input.leadDays < 1 || input.leadDays > 180) return badQuote("Lead time must be 1 to 180 days.");
  if (input.sample !== null && (!Number.isInteger(input.sample) || input.sample < 0 || input.sample > 10_000_000)) return badQuote("The sample price doesn't look right.");
  const note = input.note.trim();
  if (note.length > 500) return badQuote("Keep the note under 500 characters.");
  const quote: Quote = {
    id: p.existing?.id ?? p.id,
    rfqId: rfq.id,
    sellerId: p.sellerId,
    slug: input.slug,
    unitPrice: input.unitPrice,
    moq: input.moq,
    leadDays: input.leadDays,
    sample: input.sample,
    note,
    status: "offered",
    createdAt: p.existing?.createdAt ?? p.at,
    updatedAt: p.at,
    holdUntil: null,
    usedAt: null,
  };
  return ok({ quote, event: { type: "QuoteOffered", rfqId: rfq.id, quoteId: quote.id, buyerId: rfq.buyerId, sellerId: p.sellerId, item: rfq.item, updated: p.existing !== null, at: p.at } });
}

export function withdrawQuote(q: Quote, at: Date): Result<Quote, SourcingError> {
  if (q.status !== "offered") return err(domainError("closed", "Only a quote on offer can be withdrawn."));
  return ok({ ...q, status: "withdrawn", updatedAt: at });
}

/** The buyer takes one quote: the request is ordered, the others are declined, the price is held. */
export function acceptQuote(rfq: Rfq, quotes: readonly Quote[], quoteId: string, at: Date): Result<{ rfq: Rfq; quotes: Quote[]; event: QuoteAccepted }, SourcingError> {
  if (!isOpen(rfq, at)) return err(domainError("closed", "This request is closed."));
  const chosen = quotes.find((q) => q.id === quoteId && q.rfqId === rfq.id);
  if (!chosen || chosen.status !== "offered") return err(domainError("not_found", "That quote isn't on offer any more."));
  const next = quotes.map((q): Quote => (q.id === quoteId ? { ...q, status: "accepted", holdUntil: new Date(at.getTime() + HOLD_DAYS * DAY), updatedAt: at } : q.status === "offered" ? { ...q, status: "declined", updatedAt: at } : q));
  return ok({
    rfq: { ...rfq, status: "ordered" },
    quotes: next,
    event: { type: "QuoteAccepted", rfqId: rfq.id, quoteId, buyerId: rfq.buyerId, sellerId: chosen.sellerId, slug: chosen.slug, item: rfq.item, at },
  });
}

export function closeRfq(rfq: Rfq): Result<Rfq, SourcingError> {
  if (rfq.status !== "open") return err(domainError("closed", "This request is already closed."));
  return ok({ ...rfq, status: "closed" });
}

/** Units an accepted quote covers: from its minimum to what was asked (or the minimum, if higher). */
export const quoteRange = (rfq: Pick<Rfq, "qty">, q: Pick<Quote, "moq">) => ({ min: q.moq, max: Math.max(rfq.qty, q.moq) });

/** The price an accepted quote still holds, if any. */
export function heldPrice(rfq: Rfq, q: Quote, now: Date): { price: Cents; qty: number; minQty: number } | null {
  if (q.status !== "accepted" || q.usedAt || !q.holdUntil || q.holdUntil <= now) return null;
  const range = quoteRange(rfq, q);
  return { price: q.unitPrice, qty: range.max, minQty: range.min };
}
