"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { SHOW_KINDS, type LotView, type MessageView, type ShowView } from "@/modules/live";
import { money } from "@/shared/kernel";
import { actorFor } from "../actor";
import { LIVE_TAG } from "../cache-tags";
import { services } from "../container";
import { allow, clientIp, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { currentShop, myShops } from "../shop";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const showId = z.string().min(1).max(64);
const slug = z.string().min(1).max(120);

// ── Viewers ────────────────────────────────────────────────────────────────────

export async function sayAction(id: string, text: string): Promise<{ ok: true; message: MessageView } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("signed_out", "Sign in to chat.");
  if (!(await allow("live.chat", account.id))) return RATE_LIMITED;
  const p = z.object({ id: showId, text: z.string().max(1000) }).safeParse({ id, text });
  if (!p.success) return fail("invalid", "That message couldn't be sent.");
  const shops = (await myShops()).map((m) => m.sellerId);
  const r = await (await services()).live.say({ ...(await actorFor(account)), shops }, p.data.id, p.data.text);
  return r.ok ? { ok: true, message: r.value } : fail(r.error.code, r.error.message);
}

export async function heartAction(id: string): Promise<void> {
  if (!showId.safeParse(id).success || !(await allow("live.heart", await clientIp()))) return;
  await (await services()).live.heart(id);
}

/** Lock the live price for the viewer so checkout honours it. */
export async function holdPriceAction(id: string, productSlug: string): Promise<{ ok: true; price: number; expiresAt: string } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("signed_out", "Sign in to get the live price.");
  if (!(await allow("live.bid", account.id))) return RATE_LIMITED;
  const p = z.object({ id: showId, slug }).safeParse({ id, slug: productSlug });
  if (!p.success) return fail("invalid", "No such product.");
  const r = await (await services()).live.holdPrice(account.id, p.data.id, p.data.slug);
  return r.ok ? { ok: true, ...r.value } : fail(r.error.code, r.error.message);
}

export async function bidAction(lotId: string, amount: number): Promise<{ ok: true; lot: LotView } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("signed_out", "Sign in to bid.");
  if (!(await allow("live.bid", account.id))) return RATE_LIMITED;
  const p = z.object({ lotId: z.uuid(), amount: z.number().positive().max(1_000_000) }).safeParse({ lotId, amount });
  if (!p.success) return fail("invalid", "That bid couldn't be read.");
  const r = await (await services()).live.bid({ accountId: account.id, name: (await actorFor(account)).name }, p.data.lotId, money.fromDollars(p.data.amount));
  return r.ok ? { ok: true, lot: r.value } : fail(r.error.code, r.error.message);
}

// ── Hosts ──────────────────────────────────────────────────────────────────────

async function host() {
  const s = await currentShop();
  if (!s) return { allowed: false as const, error: fail("forbidden", "Open your shop first.") };
  if (!(await allow("account.write", s.account.id))) return { allowed: false as const, error: RATE_LIMITED as Failure };
  return { allowed: true as const, ...s, live: (await services()).live };
}

const Schedule = z.object({
  title: z.string().max(200),
  kind: z.enum(SHOW_KINDS),
  coverUrl: z.string().min(1).max(400),
  place: z.string().max(120),
  hostName: z.string().max(60),
  /** Minutes from now; 0 means now. */
  startsIn: z.number().int().min(0).max(60 * 24 * 30),
  items: z.array(z.object({ slug, livePrice: z.number().positive().max(1_000_000).nullable() })).max(30),
});

export async function scheduleShowAction(input: z.input<typeof Schedule>): Promise<{ ok: true; show: ShowView } | Failure> {
  const h = await host();
  if (!h.allowed) return h.error;
  const p = Schedule.safeParse(input);
  if (!p.success) return fail("invalid", "Check the show details.");
  const r = await h.live.schedule(
    { accountId: h.account.id, name: p.data.hostName || "Host", sellerId: h.sellerId },
    {
      title: p.data.title,
      kind: p.data.kind,
      coverUrl: p.data.coverUrl,
      place: p.data.place,
      scheduledFor: new Date(Date.now() + p.data.startsIn * 60_000),
      items: p.data.items.map((i) => ({ slug: i.slug, livePrice: i.livePrice === null ? null : money.fromDollars(i.livePrice) })),
    },
  );
  if (!r.ok) return fail(r.error.code, r.error.message);
  updateTag(LIVE_TAG);
  return { ok: true, show: r.value };
}

export async function startShowAction(id: string): Promise<{ ok: true } | Failure> {
  const h = await host();
  if (!h.allowed) return h.error;
  const r = await h.live.start(h.sellerId, showId.parse(id));
  if (!r.ok) return fail(r.error.code, r.error.message);
  updateTag(LIVE_TAG);
  return { ok: true };
}

export async function endShowAction(id: string): Promise<{ ok: true } | Failure> {
  const h = await host();
  if (!h.allowed) return h.error;
  const r = await h.live.end(h.sellerId, showId.parse(id));
  if (!r.ok) return fail(r.error.code, r.error.message);
  updateTag(LIVE_TAG);
  return { ok: true };
}

export async function pinItemAction(id: string, productSlug: string): Promise<{ ok: true } | Failure> {
  const h = await host();
  if (!h.allowed) return h.error;
  const r = await h.live.pinItem(h.sellerId, showId.parse(id), slug.parse(productSlug));
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

export async function pinQuestionAction(id: string, q: string, a: string): Promise<{ ok: true } | Failure> {
  const h = await host();
  if (!h.allowed) return h.error;
  const p = z.object({ q: z.string().max(400), a: z.string().max(600) }).safeParse({ q, a });
  if (!p.success) return fail("invalid", "Too long.");
  const r = await h.live.pinQuestion(h.sellerId, showId.parse(id), p.data.q, p.data.a);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}

export async function addLotAction(id: string, input: { slug: string; startPrice: number; increment: number; minutes: number }): Promise<{ ok: true; lot: LotView } | Failure> {
  const h = await host();
  if (!h.allowed) return h.error;
  const p = z.object({ slug, startPrice: z.number().positive().max(1_000_000), increment: z.number().positive().max(100_000), minutes: z.number().min(0.5).max(30) }).safeParse(input);
  if (!p.success) return fail("invalid", "Check the lot.");
  const r = await h.live.addLot(h.sellerId, showId.parse(id), {
    slug: p.data.slug,
    startPrice: money.fromDollars(p.data.startPrice),
    increment: money.fromDollars(p.data.increment),
    durationMs: Math.round(p.data.minutes * 60_000),
  });
  return r.ok ? { ok: true, lot: r.value } : fail(r.error.code, r.error.message);
}
