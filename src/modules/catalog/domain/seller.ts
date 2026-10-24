export const SELLER_KINDS = ["Factory", "Maker", "Brand", "Creator", "Exporter"] as const;
export type SellerKind = (typeof SELLER_KINDS)[number];

/** The seller's public handle, used in URLs (/s/sunvolt). */
export type SellerId = string & { readonly __brand: "SellerId" };

/** Reputation and factory facts shown on a storefront. */
export type Storefront = Readonly<{
  cover: string;
  bio: string;
  followers: number;
  /** Average review score, 0–5. */
  rating: number;
  /** Median reply time in hours. */
  responseHours: number;
  /** Share of orders shipped within the promised window, 0–1. */
  onTimeRate: number;
  certificates: readonly string[];
  capacity: string | null;
  staff: number | null;
  floorArea: string | null;
  /** Country codes this seller already delivers to. */
  exportsTo: readonly string[];
}>;

export type Seller = Readonly<{
  id: SellerId;
  name: string;
  kind: SellerKind;
  city: string;
  avatar: string;
  verified: boolean;
  /** Month of the last on-site audit (e.g. "Sep 2026"), for factories. */
  audited: string | null;
  yearsInBusiness: number | null;
  storefront: Storefront | null;
}>;
