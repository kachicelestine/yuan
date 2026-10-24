"use server";

import { z } from "zod";
import { brand } from "@/config/brand";
import type { AccountView } from "@/modules/identity";
import { services } from "../container";
import { endSession, startSession } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

/** Step 1 of email sign-in: send a code. The answer never reveals whether the email has an account. */
export async function requestCodeAction(email: string): Promise<{ ok: true; challengeId: string; devCode: string | null } | Failure> {
  if (typeof email !== "string" || email.length > 254) return fail("invalid_email", "That doesn't look like an email address.");
  const r = await (await services()).identity.requestEmailCode(email);
  return r.ok ? { ok: true, ...r.value } : fail(r.error.code, r.error.message);
}

const Verify = z.object({ challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/, "Codes are 6 digits.") });

/** Step 2: check the code and sign in. */
export async function verifyCodeAction(challengeId: string, code: string): Promise<{ ok: true; account: AccountView } | Failure> {
  const input = Verify.safeParse({ challengeId, code: typeof code === "string" ? code.trim() : code });
  if (!input.success) return fail("wrong_code", "Codes are 6 digits.");
  const r = await (await services()).identity.verifyEmailCode(input.data.challengeId, input.data.code);
  if (!r.ok) return fail(r.error.code, r.error.message);
  await startSession(r.value);
  return { ok: true, account: r.value.account };
}

const site = new URL(brand.url);

/** Wallet sign-in, step 1: the EIP-4361 message for the wallet to sign. Names our own domain, never the request's. */
export async function walletChallengeAction(address: string, chainId: number): Promise<{ ok: true; nonce: string; message: string } | Failure> {
  const input = z.object({ address: z.string().max(42), chainId: z.number().int().positive().max(2 ** 32) }).safeParse({ address, chainId });
  if (!input.success) return fail("invalid_address", "That isn't an Ethereum address.");
  const r = await (await services()).identity.startWalletSignIn({ ...input.data, domain: site.host, uri: site.origin, appName: brand.name });
  return r.ok ? { ok: true, ...r.value } : fail(r.error.code, r.error.message);
}

/** Wallet sign-in, step 2: verify the signature and sign in. */
export async function walletVerifyAction(nonce: string, signature: string): Promise<{ ok: true; account: AccountView } | Failure> {
  const input = z.object({ nonce: z.string().regex(/^[0-9a-f]{24}$/), signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) }).safeParse({ nonce, signature });
  if (!input.success) return fail("bad_signature", "The wallet's signature couldn't be read.");
  const r = await (await services()).identity.completeWalletSignIn(input.data.nonce, input.data.signature);
  if (!r.ok) return fail(r.error.code, r.error.message);
  await startSession(r.value);
  return { ok: true, account: r.value.account };
}

export async function signOutAction() {
  await endSession();
}
