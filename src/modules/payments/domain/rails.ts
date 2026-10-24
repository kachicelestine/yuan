/**
 * The ways a buyer can pay: a dollar stablecoin on a network. Every rail settles in
 * USD terms, so prices never need converting at checkout.
 */
export const RAILS = [
  { id: "usdc-base", asset: "USDC", network: "Base", settlesIn: "about 2 seconds", fee: "under 1¢" },
  { id: "usdc-solana", asset: "USDC", network: "Solana", settlesIn: "under a second", fee: "under 1¢" },
  { id: "usdt-tron", asset: "USDT", network: "Tron", settlesIn: "about a minute", fee: "about $1" },
] as const;

export type Rail = (typeof RAILS)[number];
export type RailId = Rail["id"];

export const DEFAULT_RAIL: RailId = "usdc-base";

export const isRailId = (value: string): value is RailId => RAILS.some((r) => r.id === value);
