"use server";

import { z } from "zod";
import { money } from "@/shared/kernel";
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
