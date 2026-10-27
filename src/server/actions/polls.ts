"use server";

import { z } from "zod";
import type { PollView } from "@/modules/engagement";
import { actorFor } from "../actor";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { voter } from "../voter";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const Slugs = z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).min(2).max(3);

/** Starts a "this or that?" poll the asker can send to friends. */
export async function createPollAction(slugs: string[], question: string): Promise<{ ok: true; id: string } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in to ask friends.");
  if (!(await allow("content.post", account.id))) return RATE_LIMITED;
  const s = Slugs.safeParse(slugs);
  if (!s.success) return fail("invalid_poll", "Pick two or three products to choose between.");
  const app = await services();
  // Only products that exist, so a poll never shows an empty card.
  const found = await app.catalog.getProductsBySlugs(s.data);
  if (found.length !== new Set(s.data).size) return fail("invalid_poll", "One of those products isn't available any more.");
  const r = await app.polls.create(await actorFor(account), { question: z.string().max(200).catch("").parse(question), slugs: s.data });
  return r.ok ? { ok: true, id: r.value.id } : fail(r.error.code, r.error.message);
}

/** A vote (or a changed mind), with an optional reason. No account needed. */
export async function votePollAction(id: string, choice: number, reason: string | null): Promise<{ ok: true; poll: PollView } | Failure> {
  const account = await currentAccount();
  const who = account?.id ?? (await voter());
  if (!(await allow("content.react", who))) return RATE_LIMITED;
  const r = await (await services()).polls.vote(z.string().max(20).catch("").parse(id), {
    voter: who,
    accountId: account?.id ?? null,
    name: account ? (await actorFor(account)).name : "A friend",
    choice: z.number().int().catch(-1).parse(choice),
    reason: reason === null ? null : z.string().max(400).catch("").parse(reason),
  });
  return r.ok ? { ok: true, poll: r.value } : fail(r.error.code, r.error.message);
}
