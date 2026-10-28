import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

/** Who runs a shop: the owner who applied, and staff they add later. */
export type MemberRole = "owner" | "staff";

export type Membership = Readonly<{ sellerId: string; accountId: string; role: MemberRole; since: Date }>;

/**
 * An owner asks someone to help run the shop. It's addressed to an email: whoever signs in
 * with that email (which proves they own it) can accept it and joins as staff.
 */
export type Invitation = Readonly<{
  id: string;
  sellerId: string;
  email: string;
  invitedBy: string;
  createdAt: Date;
  acceptedAt: Date | null;
  acceptedBy: string | null;
  revokedAt: Date | null;
}>;

export type TeamError = DomainError<"not_owner" | "invalid_email" | "already_member" | "team_full" | "not_found" | "not_allowed">;

/** People per shop, owner included. */
export const MAX_TEAM = 20;
/** An invitation not accepted within this many days lapses. */
export const INVITE_DAYS = 14;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isOpen = (i: Invitation, now: Date) => !i.acceptedAt && !i.revokedAt && now.getTime() - i.createdAt.getTime() < INVITE_DAYS * 86_400_000;

export function invite(p: { id: string; sellerId: string; email: string; invitedBy: string; team: number; members: readonly string[]; at: Date }): Result<Invitation, TeamError> {
  const email = p.email.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return err(domainError("invalid_email", "Enter their email address."));
  if (p.members.includes(email)) return err(domainError("already_member", "They're already on the team."));
  if (p.team >= MAX_TEAM) return err(domainError("team_full", `A shop can have up to ${MAX_TEAM} people.`));
  return ok({ id: p.id, sellerId: p.sellerId, email, invitedBy: p.invitedBy, createdAt: p.at, acceptedAt: null, acceptedBy: null, revokedAt: null });
}
