"use server";

import { z } from "zod";
import type { BoardView } from "@/modules/engagement";
import { actorFor } from "../actor";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };
type Done = { ok: true; board: BoardView } | Failure;
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const Id = z.string().regex(/^[a-z2-9]{8}$/).catch("");
const Slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const Name = z.string().max(200).catch("");

async function signedIn() {
  const account = await currentAccount();
  if (!account) return { error: fail("sign_in_required", "Sign in to make boards.") } as const;
  if (!(await allow("account.write", account.id))) return { error: RATE_LIMITED } as const;
  return { account, app: await services() } as const;
}

const done = (r: { ok: true; value: BoardView } | { ok: false; error: { code: string; message: string } }): Done => (r.ok ? { ok: true, board: r.value } : fail(r.error.code, r.error.message));

/** A new board, optionally starting with one product. */
export async function createBoardAction(name: string, isPublic: boolean, firstSlug: string | null): Promise<Done> {
  const s = await signedIn();
  if ("error" in s) return s.error!;
  const slug = firstSlug === null ? null : Slug.safeParse(firstSlug).data ?? null;
  if (slug && !(await s.app.catalog.getProductsBySlugs([slug])).length) return fail("not_found", "That product isn't available any more.");
  return done(await s.app.boards.create({ accountId: s.account.id, name: actorFor(s.account).name }, Name.parse(name), isPublic === true, slug));
}

export async function editBoardAction(id: string, patch: { name?: string; isPublic?: boolean }): Promise<Done> {
  const s = await signedIn();
  if ("error" in s) return s.error!;
  const p = z.object({ name: z.string().max(200).optional(), isPublic: z.boolean().optional() }).catch({}).parse(patch);
  return done(await s.app.boards.edit(s.account.id, Id.parse(id), p));
}

export async function deleteBoardAction(id: string): Promise<{ ok: true } | Failure> {
  const s = await signedIn();
  if ("error" in s) return s.error!;
  const r = await s.app.boards.remove(s.account.id, Id.parse(id));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

/** Puts a product on one of your boards, or takes it off. */
export async function setBoardItemAction(id: string, slug: string, on: boolean): Promise<Done> {
  const s = await signedIn();
  if ("error" in s) return s.error!;
  const parsed = Slug.safeParse(slug);
  if (!parsed.success) return fail("not_found", "No such product.");
  if (on && !(await s.app.catalog.getProductsBySlugs([parsed.data])).length) return fail("not_found", "That product isn't available any more.");
  return done(await s.app.boards.toggle(s.account.id, Id.parse(id), parsed.data, on === true));
}

export async function followBoardAction(id: string, on: boolean): Promise<Done> {
  const s = await signedIn();
  if ("error" in s) return s.error!;
  return done(await s.app.boards.follow(s.account.id, Id.parse(id), on === true));
}
