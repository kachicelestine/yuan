import type { Commission, Creator, Program } from "./affiliate";

export interface CreatorRepository {
  byAccount(accountId: string): Promise<Creator | null>;
  byCode(code: string): Promise<Creator | null>;
  byAccounts(accountIds: readonly string[]): Promise<Creator[]>;
  /** False when the account already has a code or the code is taken. */
  create(creator: Creator): Promise<boolean>;
  save(creator: Creator): Promise<void>;
}

export interface ProgramRepository {
  /** Shops that never chose a rate are absent. */
  rates(sellerIds: readonly string[]): Promise<Map<string, number>>;
  save(program: Program): Promise<void>;
}

export interface ClickRepository {
  /** Counts a click on a link (`slug` empty for links to anything but a product). */
  add(code: string, slug: string, day: string): Promise<void>;
  /** Clicks per product since `sinceDay`, most first. */
  bySlug(code: string, sinceDay: string): Promise<{ slug: string; clicks: number }[]>;
  total(code: string, sinceDay: string): Promise<number>;
}

export interface CommissionRepository {
  find(orderId: string, sellerId: string): Promise<Commission | null>;
  forOrder(orderId: string): Promise<Commission[]>;
  /** False when the order and shop already have one (attribution runs at least once). */
  add(commission: Commission): Promise<boolean>;
  save(commission: Commission): Promise<void>;
  /** Newest first. */
  forCreator(creatorId: string, limit: number): Promise<Commission[]>;
  forSeller(sellerId: string, limit: number): Promise<Commission[]>;
}
