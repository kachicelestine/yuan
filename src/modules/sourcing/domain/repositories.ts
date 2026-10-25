import type { Quote, Rfq } from "./rfq";

export interface RfqRepository {
  find(id: string): Promise<Rfq | null>;
  save(rfq: Rfq): Promise<void>;
  /** A buyer's requests, newest first. */
  forBuyer(buyerId: string, limit: number): Promise<Rfq[]>;
  openCount(buyerId: string, now: Date): Promise<number>;
  /** Requests sent to a shop, newest first. */
  forSeller(sellerId: string, limit: number): Promise<Rfq[]>;
  /** Closes open requests whose time is up; returns how many. */
  expire(now: Date): Promise<number>;
}

export interface QuoteRepository {
  find(id: string): Promise<Quote | null>;
  forRfqs(rfqIds: readonly string[]): Promise<Quote[]>;
  bySeller(rfqId: string, sellerId: string): Promise<Quote | null>;
  save(quote: Quote): Promise<void>;
  /** Accepted, unused quotes for this buyer and listing, with their requests. */
  held(buyerId: string, slug: string, now: Date): Promise<{ rfq: Rfq; quote: Quote }[]>;
  /** Marks this buyer's held quotes for these listings as used; returns how many. */
  use(buyerId: string, slugs: readonly string[], at: Date): Promise<number>;
}
