import { domainError, err, ok, type Clock, type Result } from "@/shared/kernel";
import { invite, isOpen, type Invitation, type MemberRole, type TeamError } from "../domain/membership";
import type { InvitationRepository, MembershipRepository } from "../domain/repositories";

export type TeamDeps = {
  memberships: MembershipRepository;
  invitations: InvitationRepository;
  /** Emails of these accounts, to stop inviting someone who's already on the team. */
  emails: (accountIds: readonly string[]) => Promise<Map<string, string>>;
  clock: Clock;
  newId: () => string;
};

export type MemberView = { accountId: string; role: MemberRole; since: string };
export type InvitationView = { id: string; sellerId: string; email: string; createdAt: string };

const toInvitationView = (i: Invitation): InvitationView => ({ id: i.id, sellerId: i.sellerId, email: i.email, createdAt: i.createdAt.toISOString() });

/** Who helps run a shop: the owner invites staff by email, removes them, and staff can leave. */
export function makeTeam({ memberships, invitations, emails, clock, newId }: TeamDeps) {
  async function owner(accountId: string, sellerId: string) {
    return (await memberships.find(sellerId, accountId))?.role === "owner";
  }

  return {
    async members(sellerId: string): Promise<MemberView[]> {
      return (await memberships.forSeller(sellerId)).map((m) => ({ accountId: m.accountId, role: m.role, since: m.since.toISOString() }));
    },

    /** Invitations still waiting for an answer. */
    async pending(sellerId: string): Promise<InvitationView[]> {
      const now = clock.now();
      return (await invitations.forSeller(sellerId)).filter((i) => isOpen(i, now)).map(toInvitationView);
    },

    async invite(ownerId: string, sellerId: string, email: string): Promise<Result<InvitationView, TeamError>> {
      if (!(await owner(ownerId, sellerId))) return err(domainError("not_owner", "Only the shop's owner can add people."));
      const now = clock.now();
      const [team, open] = await Promise.all([memberships.forSeller(sellerId), invitations.forSeller(sellerId)]);
      const memberEmails = [...(await emails(team.map((m) => m.accountId))).values()].map((e) => e.toLowerCase());
      const r = invite({ id: newId(), sellerId, email, invitedBy: ownerId, team: team.length + open.filter((i) => isOpen(i, now)).length, members: memberEmails, at: now });
      if (!r.ok) return r;
      // Asking the same person again replaces the old invitation.
      for (const i of open) if (isOpen(i, now) && i.email === r.value.email) await invitations.save({ ...i, revokedAt: now });
      await invitations.save(r.value);
      return ok(toInvitationView(r.value));
    },

    async revoke(ownerId: string, sellerId: string, invitationId: string): Promise<Result<true, TeamError>> {
      if (!(await owner(ownerId, sellerId))) return err(domainError("not_owner", "Only the shop's owner can do that."));
      const i = await invitations.find(invitationId);
      if (!i || i.sellerId !== sellerId || !isOpen(i, clock.now())) return err(domainError("not_found", "That invitation is gone."));
      await invitations.save({ ...i, revokedAt: clock.now() });
      return ok(true);
    },

    /** Invitations waiting for whoever owns this email (shown once they sign in with it). */
    async invitesFor(email: string | null): Promise<InvitationView[]> {
      if (!email) return [];
      const now = clock.now();
      return (await invitations.forEmail(email.toLowerCase())).filter((i) => isOpen(i, now)).map(toInvitationView);
    },

    /** Joins the shop as staff. The invitation must be addressed to the email they signed in with. */
    async accept(accountId: string, email: string | null, invitationId: string): Promise<Result<{ sellerId: string }, TeamError>> {
      const i = await invitations.find(invitationId);
      const now = clock.now();
      if (!i || !email || i.email !== email.toLowerCase() || !isOpen(i, now)) return err(domainError("not_found", "That invitation isn't for this account, or it has lapsed."));
      if (!(await memberships.find(i.sellerId, accountId))) await memberships.add({ sellerId: i.sellerId, accountId, role: "staff", since: now });
      await invitations.save({ ...i, acceptedAt: now, acceptedBy: accountId });
      return ok({ sellerId: i.sellerId });
    },

    async decline(email: string | null, invitationId: string): Promise<Result<true, TeamError>> {
      const i = await invitations.find(invitationId);
      if (!i || !email || i.email !== email.toLowerCase() || !isOpen(i, clock.now())) return err(domainError("not_found", "That invitation is gone."));
      await invitations.save({ ...i, revokedAt: clock.now() });
      return ok(true);
    },

    /** The owner removes someone, or a staff member leaves. Owners can't be removed. */
    async remove(byId: string, sellerId: string, accountId: string): Promise<Result<true, TeamError>> {
      const target = await memberships.find(sellerId, accountId);
      if (!target) return err(domainError("not_found", "They're not on the team."));
      if (target.role === "owner") return err(domainError("not_allowed", "The owner can't be removed."));
      if (byId !== accountId && !(await owner(byId, sellerId))) return err(domainError("not_owner", "Only the shop's owner can remove people."));
      await memberships.remove(sellerId, accountId);
      return ok(true);
    },
  };
}

export type Team = ReturnType<typeof makeTeam>;
