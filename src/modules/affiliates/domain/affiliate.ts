import { domainError, err, money, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// Creators earn a share of the orders their links bring in. A shop chooses the share
// (its programme rate) and pays it out of its own takings when the parcel is delivered;
// the buyer pays nothing extra. Attribution is the last creator link the buyer followed
// within ATTRIBUTION_DAYS of ordering.

/** How long a creator link counts after the buyer follows it. */
export const ATTRIBUTION_DAYS = 7;

/** Rates a shop can offer; 0 means the shop isn't in the programme. */
export const PROGRAM_RATES = [0, 0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25] as const;

/** A new shop's rate until it chooses one. */
export const DEFAULT_RATE = 0.1;

export type Creator = Readonly<{
  accountId: string;
  /** Goes in links: /p/solar-panel?ref=k7m2qx9 */
  code: string;
  /** USDC on Base, for payouts. */
  wallet: string | null;
  createdAt: Date;
}>;

export type Program = Readonly<{ sellerId: string; rate: number; updatedAt: Date }>;

export type CommissionStatus = "pending" | "earned" | "void";

/** What one creator earns from one shop's part of one order. */
export type Commission = Readonly<{
  id: string;
  orderId: string;
  sellerId: string;
  creatorId: string;
  code: string;
  /** The shop's lines in the order, before the coupon. */
  base: Cents;
  rate: number;
  amount: Cents;
  /** Products in those lines, for per-link stats. */
  slugs: readonly string[];
  status: CommissionStatus;
  createdAt: Date;
  settledAt: Date | null;
}>;

export type CommissionEarned = Readonly<{ type: "CommissionEarned"; commissionId: string; creatorId: string; orderId: string; sellerId: string; amount: Cents; at: Date }>;

export type AffiliateError = DomainError<"invalid_rate" | "invalid_address" | "not_found">;

// Lower case without look-alikes (no i, l, o, 0, 1): easy to read out and to type.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const CODE_LENGTH = 7;
export const isCode = (value: string) => /^[a-z2-9]{7}$/.test(value);

/** A fresh creator code. `random` returns values in [0, 1). */
export function newCode(random: () => number = Math.random) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export function setRate(sellerId: string, rate: number, at: Date): Result<Program, AffiliateError> {
  if (!PROGRAM_RATES.includes(rate as (typeof PROGRAM_RATES)[number])) {
    return err(domainError("invalid_rate", `Pick one of ${PROGRAM_RATES.map((r) => `${r * 100}%`).join(", ")}.`));
  }
  return ok({ sellerId, rate, updatedAt: at });
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function setWallet(creator: Creator, wallet: string): Result<Creator, AffiliateError> {
  const w = wallet.trim();
  if (!EVM_ADDRESS.test(w)) return err(domainError("invalid_address", "That isn't a USDC wallet address on Base (0x followed by 40 characters)."));
  return ok({ ...creator, wallet: w });
}

/**
 * A commission for one shop's part of an order, or null when nothing is owed: the shop
 * isn't in the programme, the creator bought it themselves or works for the shop.
 */
export function commissionFor(props: {
  id: string;
  orderId: string;
  sellerId: string;
  creator: Creator;
  buyerId: string;
  creatorRunsShop: boolean;
  base: Cents;
  rate: number;
  slugs: readonly string[];
  at: Date;
}): Commission | null {
  if (props.rate <= 0 || props.creator.accountId === props.buyerId || props.creatorRunsShop) return null;
  const amount = money.cents(Math.floor(props.base * props.rate));
  if (amount <= 0) return null;
  return {
    id: props.id,
    orderId: props.orderId,
    sellerId: props.sellerId,
    creatorId: props.creator.accountId,
    code: props.creator.code,
    base: props.base,
    rate: props.rate,
    amount,
    slugs: [...props.slugs],
    status: "pending",
    createdAt: props.at,
    settledAt: null,
  };
}

/** Delivered: the creator earns it. Refunded: it's void. Settling twice changes nothing. */
export function settle(c: Commission, outcome: "earned" | "void", at: Date): { commission: Commission; event: CommissionEarned | null } | null {
  if (c.status !== "pending") return null;
  const commission: Commission = { ...c, status: outcome, settledAt: at };
  const event: CommissionEarned | null =
    outcome === "earned" ? { type: "CommissionEarned", commissionId: c.id, creatorId: c.creatorId, orderId: c.orderId, sellerId: c.sellerId, amount: c.amount, at } : null;
  return { commission, event };
}
