"use server";

import { z } from "zod";
import { SELLER_KINDS } from "@/modules/catalog";
import { DOCUMENT_KINDS, type ApplicationView } from "@/modules/merchants";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const signedOut = () => fail("signed_out", "Sign in to apply.");

// Shapes only; the merchants domain checks the rules and words the errors.
const Details = z.object({
  name: z.string().max(200),
  handle: z.string().max(60),
  kind: z.enum(SELLER_KINDS),
  country: z.string().max(4),
  city: z.string().max(200),
  address: z.string().max(600),
  phone: z.string().max(40),
  website: z.string().max(400).nullable(),
  yearsInBusiness: z.number().int().min(0).max(500).nullable(),
  description: z.string().max(2000),
});

async function applicant() {
  const account = await currentAccount();
  if (!account) return { allowed: false as const, error: signedOut() };
  if (!(await allow("account.write", account.id))) return { allowed: false as const, error: RATE_LIMITED as Failure };
  return { allowed: true as const, account, onboarding: (await services()).onboarding };
}

export async function saveApplicationAction(details: z.input<typeof Details>, payoutWallet: string | null): Promise<{ ok: true; application: ApplicationView } | Failure> {
  const a = await applicant();
  if (!a.allowed) return a.error;
  const parsed = Details.safeParse(details);
  const wallet = z.string().max(100).nullable().safeParse(payoutWallet);
  if (!parsed.success || !wallet.success) return fail("invalid", "Check the form and try again.");
  const r = await a.onboarding.saveDetails(a.account.id, parsed.data, wallet.data);
  return r.ok ? { ok: true, application: r.value } : fail(r.error.code, r.error.message);
}

const Doc = z.object({ kind: z.enum(DOCUMENT_KINDS), contentType: z.string().max(100), bytes: z.number().int().positive() });

export async function startDocumentAction(file: z.input<typeof Doc>): Promise<{ ok: true; key: string; url: string; headers: Record<string, string> } | Failure> {
  const a = await applicant();
  if (!a.allowed) return a.error;
  const parsed = Doc.safeParse(file);
  if (!parsed.success) return fail("invalid", "That file couldn't be read.");
  const r = await a.onboarding.startDocument(a.account.id, parsed.data);
  return r.ok ? { ok: true, key: r.value.key, url: r.value.url, headers: { ...r.value.headers } } : fail(r.error.code, r.error.message);
}

export async function attachDocumentAction(input: { kind: string; key: string }): Promise<{ ok: true; application: ApplicationView } | Failure> {
  const a = await applicant();
  if (!a.allowed) return a.error;
  const parsed = z.object({ kind: z.enum(DOCUMENT_KINDS), key: z.string().min(1).max(256) }).safeParse(input);
  if (!parsed.success) return fail("invalid", "That document couldn't be read.");
  const r = await a.onboarding.attachDocument(a.account.id, parsed.data);
  return r.ok ? { ok: true, application: r.value } : fail(r.error.code, r.error.message);
}

export async function submitApplicationAction(): Promise<{ ok: true; application: ApplicationView } | Failure> {
  const a = await applicant();
  if (!a.allowed) return a.error;
  const r = await a.onboarding.submit(a.account.id);
  return r.ok ? { ok: true, application: r.value } : fail(r.error.code, r.error.message);
}
