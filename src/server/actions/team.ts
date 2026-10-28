"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accountIdByEmail } from "../adapters/account-emails";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { currentShop } from "../shop";

type Failure = { ok: false; code: string; message: string };
type Done = { ok: true } | Failure;
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const Id = z.uuid();

async function shop() {
  const s = await currentShop();
  if (!s) return { error: fail("forbidden", "Open your shop first.") } as const;
  if (!(await allow("account.write", s.account.id))) return { error: RATE_LIMITED as Failure } as const;
  return { ...s, app: await services() } as const;
}

async function me() {
  const account = await currentAccount();
  if (!account) return { error: fail("sign_in_required", "Sign in first.") } as const;
  if (!(await allow("account.write", account.id))) return { error: RATE_LIMITED as Failure } as const;
  return { account, app: await services() } as const;
}

/** The owner invites someone by email; if they already have an account, they hear about it. */
export async function inviteStaffAction(email: string): Promise<{ ok: true; id: string } | Failure> {
  const s = await shop();
  if ("error" in s) return s.error!;
  const r = await s.app.team.invite(s.account.id, s.sellerId, z.string().max(200).catch("").parse(email));
  if (!r.ok) return fail(r.error.code, r.error.message);
  const invitee = await accountIdByEmail(s.app.db, r.value.email);
  if (invitee) {
    const page = await s.app.catalog.getSeller(s.sellerId);
    await s.app.notifications.notify([invitee], { kind: "team", title: "You're invited to a shop", body: `${page?.seller.name ?? "A shop"} asked you to help run it. Open Sell to accept.`, link: "/sell", email: true }, `invite:${r.value.id}`);
  }
  revalidatePath("/sell/team");
  return { ok: true, id: r.value.id };
}

export async function revokeInviteAction(invitationId: string): Promise<Done> {
  const s = await shop();
  if ("error" in s) return s.error!;
  const r = await s.app.team.revoke(s.account.id, s.sellerId, Id.catch("").parse(invitationId));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** The owner removes someone from the team. */
export async function removeMemberAction(accountId: string): Promise<Done> {
  const s = await shop();
  if ("error" in s) return s.error!;
  const r = await s.app.team.remove(s.account.id, s.sellerId, Id.catch("").parse(accountId));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** Staff leave a shop they help run. */
export async function leaveShopAction(): Promise<Done> {
  const s = await shop();
  if ("error" in s) return s.error!;
  const r = await s.app.team.remove(s.account.id, s.sellerId, s.account.id);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

export async function acceptInviteAction(invitationId: string): Promise<Done> {
  const s = await me();
  if ("error" in s) return s.error!;
  const r = await s.app.team.accept(s.account.id, s.account.email, Id.catch("").parse(invitationId));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

export async function declineInviteAction(invitationId: string): Promise<Done> {
  const s = await me();
  if ("error" in s) return s.error!;
  const r = await s.app.team.decline(s.account.email, Id.catch("").parse(invitationId));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}
