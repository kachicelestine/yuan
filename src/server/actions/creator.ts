"use server";

import { z } from "zod";
import type { SampleRequestView } from "@/modules/affiliates";
import { money } from "@/shared/kernel";
import { actorFor } from "../actor";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

async function creator() {
  const account = await currentAccount();
  if (!account) return { allowed: false as const, error: fail("sign_in_required", "Sign in first.") };
  if (!(await allow("account.write", account.id))) return { allowed: false as const, error: RATE_LIMITED as Failure };
  return { allowed: true as const, account, app: await services() };
}

/** Where creator payouts go: a USDC wallet on Base. */
export async function setCreatorWalletAction(wallet: string): Promise<{ ok: true; wallet: string } | Failure> {
  const c = await creator();
  if (!c.allowed) return c.error;
  const r = await c.app.affiliates.setWallet(c.account.id, z.string().max(100).catch("").parse(wallet));
  return r.ok ? { ok: true, wallet: r.value.wallet } : fail(r.error.code, r.error.message);
}

/** Withdraw creator earnings to the wallet above. */
export async function requestCreatorPayoutAction(dollarsAmount: number): Promise<{ ok: true } | Failure> {
  const c = await creator();
  if (!c.allowed) return c.error;
  const p = z.number().positive().max(10_000_000).safeParse(dollarsAmount);
  if (!p.success) return fail("invalid", "Enter an amount.");
  const r = await c.app.escrow.requestCreatorPayout(c.account.id, money.fromDollars(p.data));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/**
 * What the share sheet needs: the shop's creator commission (public) and, when signed in,
 * the person's own code so the link they share earns it.
 */
export async function shareInfoAction(sellerId: string): Promise<{ code: string | null; rate: number }> {
  const id = z.string().regex(/^[a-z0-9-]{1,60}$/).safeParse(sellerId);
  const app = await services();
  const rate = id.success ? await app.affiliates.rate(id.data) : 0;
  const account = await currentAccount();
  return { code: account ? (await app.affiliates.me(account.id)).code : null, rate };
}

const Address = z.object({
  name: z.string().max(120),
  line1: z.string().max(200),
  line2: z.string().max(200).default(""),
  city: z.string().max(120),
  region: z.string().max(120).default(""),
  postcode: z.string().max(30).default(""),
  country: z.string().max(4),
});

/** Asks a shop for a free sample, with where to send it. */
export async function requestSampleAction(offerId: string, address: z.input<typeof Address>, note: string): Promise<{ ok: true; request: SampleRequestView } | Failure> {
  const c = await creator();
  if (!c.allowed) return c.error;
  const id = z.uuid().safeParse(offerId);
  const a = Address.safeParse(address);
  if (!id.success || !a.success) return fail("invalid_address", "Add your name, street, city and country so the shop can send it.");
  const r = await c.app.samples.request(actorFor(c.account), id.data, a.data, z.string().max(600).catch("").parse(note));
  return r.ok ? { ok: true, request: r.value } : fail(r.error.code, r.error.message);
}
