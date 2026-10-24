import type { Lot } from "./auction";
import type { ChatMessage } from "./chat";
import type { PriceHold } from "./hold";
import type { Show, ShowStatus } from "./show";

export interface ShowRepository {
  find(id: string): Promise<Show | null>;
  save(show: Show): Promise<void>;
  /** By status: live ones most watched first, scheduled soonest first, ended newest first. */
  list(status: ShowStatus, limit: number): Promise<Show[]>;
  forSeller(sellerId: string, limit: number): Promise<Show[]>;
  /** Raises the peak if `viewers` beats it. */
  notePeak(id: string, viewers: number): Promise<void>;
}

export interface ChatRepository {
  add(message: ChatMessage): Promise<void>;
  /** The latest messages, oldest first. */
  recent(showId: string, limit: number): Promise<ChatMessage[]>;
}

export interface LotRepository {
  find(id: string): Promise<Lot | null>;
  /** The show's lots, oldest first. */
  forShow(showId: string): Promise<Lot[]>;
  insert(lot: Lot): Promise<void>;
  /** Saves only if nobody changed the lot since `lot.version - 1` was read; false when someone did. */
  update(lot: Lot): Promise<boolean>;
  /** Open lots whose time is up. */
  due(at: Date, limit: number): Promise<Lot[]>;
}

export interface HoldRepository {
  add(hold: PriceHold): Promise<void>;
  /** The best active hold this person has on a product. */
  best(accountId: string, slug: string, at: Date): Promise<PriceHold | null>;
  /** Marks this person's active holds on these products used. */
  use(accountId: string, slugs: readonly string[], at: Date): Promise<number>;
}

/** Something viewers of a show should see now (chat, a pinned product, a bid). */
export type LiveSignal = Readonly<{ type: string; [key: string]: unknown }>;

/**
 * Fans live updates out to everyone watching, across server instances. Delivery is best
 * effort: viewers reload the room's state when they reconnect.
 */
export interface LiveBus {
  publish(showId: string, signal: LiveSignal): Promise<void>;
  subscribe(showId: string, listener: (signal: LiveSignal) => void): () => void;
}
