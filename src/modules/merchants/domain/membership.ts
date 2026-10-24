/** Who runs a shop: the owner who applied, and staff they add later. */
export type MemberRole = "owner" | "staff";

export type Membership = Readonly<{ sellerId: string; accountId: string; role: MemberRole; since: Date }>;
