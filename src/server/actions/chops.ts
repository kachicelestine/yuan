"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import type { ChopOfferView, ChopView } from "@/modules/engagement";
import { money } from "@/shared/kernel";
import { actorFor } from "../actor";
import { PROMOS_TAG } from "../cache-tags";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { currentShop } from "../shop";
import { voter } from "../voter";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

/** Starts a chop on an offer (or opens the one already running). */
export async function startChopAction(offerId: string): Promise<{ ok: true; id: string } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in to start a chop.");
  if (!(await allow("account.write", account.id))) return RATE_LIMITED;
  const id = z.uuid().safeParse(offerId);
  if (!id.success) return fail("not_found", "No such chop.");
  const r = await (await services()).chops.start(await actorFor(account), id.data);
  if (r.ok) revalidateTag(PROMOS_TAG, "max");
  return r.ok ? { ok: true, id: r.value.id } : fail(r.error.code, r.error.message);
}

/** A friend's one-tap cut. No account needed. */
export async function cutChopAction(id: string): Promise<{ ok: true; chop: ChopView } | Failure> {
  const account = await currentAccount();
  const who = account?.id ?? (await voter());
  if (!(await allow("content.react", who))) return RATE_LIMITED;
  const r = await (await services()).chops.cut(z.string().max(20).catch("").parse(id), { id: who, accountId: account?.id ?? null, name: account ? (await actorFor(account)).name : "A friend" });
  return r.ok ? { ok: true, chop: r.value } : fail(r.error.code, r.error.message);
}

async function owner() {
  const s = await currentShop();
  if (!s) return { allowed: false as const, error: fail("forbidden", "Open your shop first.") };
  if (s.role !== "owner") return { allowed: false as const, error: fail("forbidden", "Only the shop's owner can run promotions.") };
  if (!(await allow("account.write", s.account.id))) return { allowed: false as const, error: RATE_LIMITED as Failure };
  return { allowed: true as const, ...s, app: await services() };
}

const Offer = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  target: z.number().positive().max(1_000_000),
  cuts: z.number().int(),
  hours: z.number().int(),
  stock: z.number().int(),
});

export async function createChopOfferAction(input: z.input<typeof Offer>): Promise<{ ok: true; offer: ChopOfferView } | Failure> {
  const s = await owner();
  if (!s.allowed) return s.error;
  const p = Offer.safeParse(input);
  if (!p.success) return fail("invalid_offer", "Check the listing, target, cuts and stock.");
  const r = await s.app.chops.createOffer(s.sellerId, { ...p.data, target: money.fromDollars(p.data.target) });
  if (r.ok) revalidateTag(PROMOS_TAG, "max");
  return r.ok ? { ok: true, offer: r.value } : fail(r.error.code, r.error.message);
}

export async function setChopOfferActiveAction(id: string, active: boolean): Promise<{ ok: true } | Failure> {
  const s = await owner();
  if (!s.allowed) return s.error;
  const offerId = z.uuid().safeParse(id);
  if (!offerId.success) return fail("not_found", "No such offer.");
  const r = await s.app.chops.setOfferActive(s.sellerId, offerId.data, active === true);
  if (r.ok) revalidateTag(PROMOS_TAG, "max");
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}
