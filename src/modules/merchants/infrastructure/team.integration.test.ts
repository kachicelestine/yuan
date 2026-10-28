import { beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { makeTeam } from "../application/team";
import { DrizzleInvitationRepository, DrizzleMembershipRepository } from "./drizzle-merchants-repositories";

// Shop staff: the owner invites by email, whoever signs in with that email joins as staff,
// the owner can remove them, staff can leave, and owners can't be removed.
describe("shop teams on Postgres", () => {
  let db: Database;
  let now = new Date("2026-10-28T10:00:00Z");
  const emails = new Map<string, string>();
  const team = () =>
    makeTeam({
      memberships: new DrizzleMembershipRepository(db),
      invitations: new DrizzleInvitationRepository(db),
      emails: async (ids) => new Map(ids.flatMap((id) => (emails.has(id) ? [[id, emails.get(id)!] as [string, string]] : []))),
      clock: { now: () => now },
      newId: () => newId(),
    });
  const owner = newId();
  const helper = newId();

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await new DrizzleMembershipRepository(db).add({ sellerId: "loom", accountId: owner, role: "owner", since: now });
    emails.set(owner, "owner@loom.example");
    emails.set(helper, "Helper@Example.com");
  });

  it("lets only the owner invite, and checks the email", async () => {
    expect(await team().invite(helper, "loom", "x@example.com")).toMatchObject({ ok: false, error: { code: "not_owner" } });
    expect(await team().invite(owner, "loom", "not an email")).toMatchObject({ ok: false, error: { code: "invalid_email" } });
    expect(await team().invite(owner, "loom", "OWNER@loom.example")).toMatchObject({ ok: false, error: { code: "already_member" } });
  });

  it("adds whoever signs in with the invited email as staff", async () => {
    const inv = await team().invite(owner, "loom", " helper@example.com ");
    if (!inv.ok) throw new Error(inv.error.message);
    expect(inv.value.email).toBe("helper@example.com");
    // Inviting again replaces the first invitation.
    const again = await team().invite(owner, "loom", "helper@example.com");
    if (!again.ok) throw new Error(again.error.message);
    expect((await team().pending("loom")).map((i) => i.id)).toEqual([again.value.id]);
    expect((await team().invitesFor("HELPER@example.com")).map((i) => i.id)).toEqual([again.value.id]);

    // Someone signed in with another email can't take it.
    expect(await team().accept(newId(), "someone@else.com", again.value.id)).toMatchObject({ ok: false });
    expect(await team().accept(helper, "helper@example.com", again.value.id)).toMatchObject({ ok: true, value: { sellerId: "loom" } });
    expect((await team().members("loom")).map((m) => [m.accountId, m.role])).toEqual([
      [owner, "owner"],
      [helper, "staff"],
    ]);
    expect(await team().pending("loom")).toEqual([]);
    // Used once.
    expect(await team().accept(newId(), "helper@example.com", again.value.id)).toMatchObject({ ok: false });
  });

  it("removes staff, lets staff leave, and keeps the owner", async () => {
    expect(await team().remove(helper, "loom", owner)).toMatchObject({ ok: false, error: { code: "not_allowed" } });
    expect(await team().remove(owner, "loom", owner)).toMatchObject({ ok: false, error: { code: "not_allowed" } });
    expect(await team().remove(owner, "loom", helper)).toMatchObject({ ok: true });
    expect((await team().members("loom")).map((m) => m.accountId)).toEqual([owner]);

    // Back again, then leaving on their own.
    const inv = await team().invite(owner, "loom", "helper@example.com");
    if (!inv.ok) throw new Error(inv.error.message);
    await team().accept(helper, "helper@example.com", inv.value.id);
    expect(await team().remove(helper, "loom", helper)).toMatchObject({ ok: true });
  });

  it("lets invitations lapse, and be declined or cancelled", async () => {
    const a = await team().invite(owner, "loom", "a@example.com");
    const b = await team().invite(owner, "loom", "b@example.com");
    if (!a.ok || !b.ok) throw new Error("invite");
    expect(await team().decline("a@example.com", a.value.id)).toMatchObject({ ok: true });
    expect(await team().revoke(owner, "loom", b.value.id)).toMatchObject({ ok: true });
    expect(await team().pending("loom")).toEqual([]);

    const c = await team().invite(owner, "loom", "c@example.com");
    if (!c.ok) throw new Error("invite");
    now = new Date(now.getTime() + 15 * 86_400_000);
    expect(await team().invitesFor("c@example.com")).toEqual([]);
    expect(await team().accept(newId(), "c@example.com", c.value.id)).toMatchObject({ ok: false });
  });
});
