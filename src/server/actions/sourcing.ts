"use server";

import { z } from "zod";
import { INCOTERMS, type RfqView, type ShopRfqView } from "@/modules/sourcing";
import { money } from "@/shared/kernel";
import { actorFor } from "../actor";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { currentShop } from "../shop";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const Code = z.string().regex(/^[a-z2-9]{8}$/).catch("");
const Slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const Dollars = z.number().finite().nonnegative().max(1_000_000);

const RfqForm = z.object({
  item: z.string().max(400),
  details: z.string().max(2000).default(""),
  slug: Slug.nullable().default(null),
  qty: z.number().int(),
  target: Dollars.nullable().default(null),
  port: z.string().max(120),
  incoterm: z.enum(INCOTERMS),
  samples: z.boolean().default(false),
});

/** Sends a request for quotes: to matching shops, or to one listing's shop. */
export async function openRfqAction(input: z.input<typeof RfqForm>): Promise<{ ok: true; rfq: RfqView } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in to request quotes.");
  if (!(await allow("content.post", account.id))) return RATE_LIMITED;
  const p = RfqForm.safeParse(input);
  if (!p.success) return fail("invalid_request", "Check the request and try again.");
  const r = await (await services()).sourcing.open(actorFor(account), { ...p.data, target: p.data.target === null || p.data.target === 0 ? null : money.fromDollars(p.data.target) });
  return r.ok ? { ok: true, rfq: r.value } : fail(r.error.code, r.error.message);
}

export async function closeRfqAction(id: string): Promise<{ ok: true; rfq: RfqView } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in first.");
  const r = await (await services()).sourcing.close(account.id, Code.parse(id));
  return r.ok ? { ok: true, rfq: r.value } : fail(r.error.code, r.error.message);
}

/** Takes a quote; the bag then gets the listing at the quoted price. */
export async function acceptQuoteAction(quoteId: string): Promise<{ ok: true; rfq: RfqView; line: { slug: string; title: string; image: string; unitPrice: number; qty: number } } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in first.");
  if (!(await allow("account.write", account.id))) return RATE_LIMITED;
  const app = await services();
  const r = await app.sourcing.accept(account.id, z.uuid().catch("").parse(quoteId));
  if (!r.ok) return fail(r.error.code, r.error.message);
  const [p] = await app.catalog.getProductsBySlugs([r.value.slug]);
  const qty = Math.min(Math.max(r.value.rfq.qty, r.value.min), r.value.max);
  return { ok: true, rfq: r.value.rfq, line: { slug: r.value.slug, title: p?.title ?? r.value.rfq.item, image: p?.images[0] ?? "", unitPrice: r.value.price, qty } };
}

const QuoteForm = z.object({
  slug: Slug,
  unitPrice: Dollars.min(0.01),
  moq: z.number().int(),
  leadDays: z.number().int(),
  sample: Dollars.nullable().default(null),
  note: z.string().max(1000).default(""),
});

/** A shop quotes (or revises its quote) on a request it was sent. */
export async function sendQuoteAction(rfqId: string, input: z.input<typeof QuoteForm>): Promise<{ ok: true; rfq: ShopRfqView } | Failure> {
  const shop = await currentShop();
  if (!shop) return fail("forbidden", "Open your shop first.");
  if (!(await allow("content.post", shop.account.id))) return RATE_LIMITED;
  const p = QuoteForm.safeParse(input);
  if (!p.success) return fail("invalid_quote", "Check the quote and try again.");
  const r = await (await services()).sourcing.quote(shop.sellerId, Code.parse(rfqId), {
    ...p.data,
    unitPrice: money.fromDollars(p.data.unitPrice),
    sample: p.data.sample === null ? null : money.fromDollars(p.data.sample),
  });
  return r.ok ? { ok: true, rfq: r.value } : fail(r.error.code, r.error.message);
}

export async function withdrawQuoteAction(rfqId: string): Promise<{ ok: true; rfq: ShopRfqView } | Failure> {
  const shop = await currentShop();
  if (!shop) return fail("forbidden", "Open your shop first.");
  const r = await (await services()).sourcing.withdraw(shop.sellerId, Code.parse(rfqId));
  return r.ok ? { ok: true, rfq: r.value } : fail(r.error.code, r.error.message);
}
