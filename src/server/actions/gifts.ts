"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { choosable } from "@/lib/gifts";
import { GIFT_THEMES, type GiftSummary, type GiftView } from "@/modules/ordering";
import { services } from "../container";
import { availableRails } from "../payments-config";
import { allow, clientIp, RATE_LIMITED } from "../rate-limits";
import { readReferral, REFERRAL_COOKIE } from "../referrals";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const Address = z.object({
  name: z.string().max(200),
  phone: z.string().max(60),
  line1: z.string().max(300),
  line2: z.string().max(300).optional(),
  city: z.string().max(120),
  region: z.string().max(120).optional(),
  postcode: z.string().max(40).optional(),
});
const Token = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/).catch("");

const Send = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  /** The sender's pick, as the bag stores it ("M · Ink"); null for the defaults. */
  option: z.string().max(120).nullable(),
  /** An option the recipient picks instead (its name, e.g. "Size"). */
  chooseOption: z.string().max(60).nullable(),
  country: z.string().regex(/^[A-Z]{2}$/),
  recipientName: z.string().max(80),
  fromName: z.string().max(80),
  theme: z.enum(GIFT_THEMES),
  message: z.string().max(400),
  hidePrice: z.boolean(),
});

/**
 * Pays for a gift: an order of one item to the recipient's country, duties prepaid, with
 * no address yet. Returns the invoice to pay; the link for the recipient is on the order.
 */
export async function sendGiftAction(input: z.input<typeof Send>): Promise<{ ok: true; invoiceId: string; orderNumber: string } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in to send a gift.");
  if (!(await allow("checkout", account.id))) return RATE_LIMITED;
  const p = Send.safeParse(input);
  if (!p.success) return fail("invalid_gift", "Check the gift and try again.");
  const app = await services();
  const [product] = await app.catalog.getProductsBySlugs([p.data.slug]);
  if (!product) return fail("unknown_product", "That isn't for sale any more.");
  // Recipients may only choose among values that cost the same, so the price can't change.
  if (p.data.chooseOption) {
    const o = product.options?.find((x) => x.name === p.data.chooseOption);
    if (!o || !choosable(o)) return fail("invalid_gift", "They can't choose that here.");
  }
  const rail = availableRails()[0];
  if (!rail) return fail("rail_unavailable", "Payments are switched off right now.");
  const referral = readReferral((await cookies()).get(REFERRAL_COOKIE)?.value);
  const r = await app.checkout({
    buyerId: account.id,
    lines: [{ slug: product.slug, option: p.data.chooseOption ? null : p.data.option, qty: 1 }],
    country: p.data.country,
    address: null,
    gift: { fromName: p.data.fromName, recipientName: p.data.recipientName, theme: p.data.theme, message: p.data.message, hidePrice: p.data.hidePrice, chooseOption: p.data.chooseOption },
    shippingMethod: "standard",
    combineParcels: true,
    payDutiesNow: true,
    couponId: null,
    rail,
    referral,
  });
  return r.ok ? { ok: true, invoiceId: r.value.invoiceId, orderNumber: r.value.orderNumber } : fail(r.error.code, r.error.message);
}

/** The values a gift's recipient may pick from, read from the listing now. */
async function choicesFor(view: GiftView) {
  if (!view.chooseOption) return [];
  const [product] = await (await services()).catalog.getProductsBySlugs([view.slug]);
  return product?.options?.find((o) => o.name === view.chooseOption)?.values.map((v) => v.label) ?? [];
}

/** The recipient adds where to deliver (and their pick). No account needed: the link is the key. */
export async function claimGiftAction(token: string, address: z.input<typeof Address>, choice: string | null): Promise<{ ok: true; gift: GiftView } | Failure> {
  if (!(await allow("account.write", await clientIp()))) return RATE_LIMITED;
  const a = Address.safeParse(address);
  if (!a.success) return fail("invalid_address", "Check the address and try again.");
  const app = await services();
  const view = await app.gifts.view(Token.parse(token));
  if (!view) return fail("not_found", "This gift link doesn't work. Ask the sender for a new one.");
  const r = await app.gifts.claim(view.token, a.data, choice === null ? null : z.string().max(120).catch("").parse(choice), await choicesFor(view));
  return r.ok ? { ok: true, gift: r.value } : fail(r.error.code, r.error.message);
}

/** The recipient reacts; the sender is told. */
export async function thankGiftAction(token: string, emoji: string): Promise<{ ok: true } | Failure> {
  if (!(await allow("content.react", await clientIp()))) return RATE_LIMITED;
  const app = await services();
  const r = await app.gifts.thank(Token.parse(token), z.string().max(16).catch("").parse(emoji));
  if (!r.ok) return fail(r.error.code, r.error.message);
  await app.notifications.notify([r.value.senderId], { kind: "gift", title: `${r.value.recipientName} says ${r.value.emoji}`, body: "They opened your gift.", link: null, email: false }, `gift-thanks:${token}:${r.value.emoji}`);
  return { ok: true };
}

/** The sender knows the address and adds it themselves. */
export async function senderGiftAddressAction(orderId: string, address: z.input<typeof Address>): Promise<{ ok: true; gift: GiftSummary } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in first.");
  if (!(await allow("account.write", account.id))) return RATE_LIMITED;
  const a = Address.safeParse(address);
  if (!a.success) return fail("invalid_address", "Check the address and try again.");
  const r = await (await services()).gifts.senderAddress(account.id, z.uuid().catch("").parse(orderId), a.data);
  return r.ok ? { ok: true, gift: r.value } : fail(r.error.code, r.error.message);
}
