"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import type { DropView, TeamOfferView, TeamView } from "@/modules/engagement";
import { money } from "@/shared/kernel";
import { actorFor } from "../actor";
import { PROMOS_TAG } from "../cache-tags";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { festivalKey, festivalStart } from "../promos";
import { currentShop } from "../shop";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const SIGN_IN = fail("sign_in_required", "Sign in first.");

async function signedIn() {
  const account = await currentAccount();
  if (!account) return { ok: false as const, error: SIGN_IN };
  if (!(await allow("account.write", account.id))) return { ok: false as const, error: RATE_LIMITED as Failure };
  return { ok: true as const, account, app: await services() };
}

const uuid = z.uuid();
const code = z.string().regex(/^[a-z2-9]{8}$/);

export async function remindDropAction(id: string, on: boolean): Promise<{ ok: true; on: boolean } | Failure> {
  const s = await signedIn();
  if (!s.ok) return s.error;
  const d = uuid.safeParse(id);
  if (!d.success) return fail("not_found", "No such drop.");
  const r = await s.app.promos.remind(s.account.id, d.data, on === true);
  return r.ok ? { ok: true, on: r.value.on } : fail(r.error.code, r.error.message);
}

export async function remindFestivalAction(on: boolean): Promise<{ ok: true; on: boolean } | Failure> {
  const s = await signedIn();
  if (!s.ok) return s.error;
  const at = festivalStart();
  await s.app.promos.remindAt(s.account.id, { key: festivalKey(at), at, title: "11.11 starts in 10 minutes", link: "/drops" }, on === true);
  return { ok: true, on: on === true };
}

/** Claims the drop price: held for 30 minutes and honoured at checkout. */
export async function claimDropAction(id: string): Promise<{ ok: true; price: number; expiresAt: string } | Failure> {
  const s = await signedIn();
  if (!s.ok) return s.error;
  const d = uuid.safeParse(id);
  if (!d.success) return fail("not_found", "No such drop.");
  const r = await s.app.promos.claim(s.account.id, d.data, 1);
  return r.ok ? { ok: true, ...r.value } : fail(r.error.code, r.error.message);
}

export async function startTeamAction(offerId: string): Promise<{ ok: true; id: string } | Failure> {
  const s = await signedIn();
  if (!s.ok) return s.error;
  const o = uuid.safeParse(offerId);
  if (!o.success) return fail("not_found", "No such team buy.");
  const r = await s.app.promos.startTeam(actorFor(s.account), o.data);
  if (r.ok) revalidateTag(PROMOS_TAG, "max");
  return r.ok ? { ok: true, id: r.value.id } : fail(r.error.code, r.error.message);
}

export async function joinTeamAction(id: string): Promise<{ ok: true; team: TeamView } | Failure> {
  const s = await signedIn();
  if (!s.ok) return s.error;
  const t = code.safeParse(id);
  if (!t.success) return fail("not_found", "No such team.");
  const r = await s.app.promos.joinTeam(t.data, actorFor(s.account));
  if (r.ok) revalidateTag(PROMOS_TAG, "max");
  return r.ok ? { ok: true, team: r.value } : fail(r.error.code, r.error.message);
}

// ── Shops ────────────────────────────────────────────────────────────────────

async function owner() {
  const s = await currentShop();
  if (!s) return { allowed: false as const, error: fail("forbidden", "Open your shop first.") };
  if (s.role !== "owner") return { allowed: false as const, error: fail("forbidden", "Only the shop's owner can run promotions.") };
  if (!(await allow("account.write", s.account.id))) return { allowed: false as const, error: RATE_LIMITED as Failure };
  return { allowed: true as const, ...s, app: await services() };
}

const Drop = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  kind: z.enum(["drop", "restock"]),
  title: z.string().max(120),
  blurb: z.string().max(400),
  startsAt: z.iso.datetime({ offset: true }),
  price: z.number().positive().max(1_000_000).nullable(),
  stock: z.number().int().nullable(),
  perPerson: z.number().int(),
});

export async function scheduleDropAction(input: z.input<typeof Drop>): Promise<{ ok: true; drop: DropView } | Failure> {
  const s = await owner();
  if (!s.allowed) return s.error;
  const p = Drop.safeParse(input);
  if (!p.success) return fail("invalid_drop", "Check the listing, time, price and stock.");
  const r = await s.app.promos.scheduleDrop(s.sellerId, { ...p.data, startsAt: new Date(p.data.startsAt), price: p.data.price === null ? null : money.fromDollars(p.data.price) });
  if (r.ok) revalidateTag(PROMOS_TAG, "max");
  return r.ok ? { ok: true, drop: r.value } : fail(r.error.code, r.error.message);
}

export async function cancelDropAction(id: string): Promise<{ ok: true } | Failure> {
  const s = await owner();
  if (!s.allowed) return s.error;
  const d = uuid.safeParse(id);
  if (!d.success) return fail("not_found", "No such drop.");
  const r = await s.app.promos.cancelDrop(s.sellerId, d.data);
  if (r.ok) revalidateTag(PROMOS_TAG, "max");
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

const TeamOffer = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/), teamPrice: z.number().positive().max(1_000_000), size: z.number().int(), hours: z.number().int(), teams: z.number().int() });

export async function createTeamOfferAction(input: z.input<typeof TeamOffer>): Promise<{ ok: true; offer: TeamOfferView } | Failure> {
  const s = await owner();
  if (!s.allowed) return s.error;
  const p = TeamOffer.safeParse(input);
  if (!p.success) return fail("invalid_offer", "Check the listing, team price, size and number of teams.");
  const r = await s.app.promos.createTeamOffer(s.sellerId, { ...p.data, teamPrice: money.fromDollars(p.data.teamPrice) });
  if (r.ok) revalidateTag(PROMOS_TAG, "max");
  return r.ok ? { ok: true, offer: r.value } : fail(r.error.code, r.error.message);
}

export async function setTeamOfferActiveAction(id: string, active: boolean): Promise<{ ok: true } | Failure> {
  const s = await owner();
  if (!s.allowed) return s.error;
  const o = uuid.safeParse(id);
  if (!o.success) return fail("not_found", "No such offer.");
  const r = await s.app.promos.setTeamOfferActive(s.sellerId, o.data, active === true);
  if (r.ok) revalidateTag(PROMOS_TAG, "max");
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}
