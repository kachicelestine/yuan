"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEPOSIT_KINDS, festivalWindow, type SellerDepositOfferView } from "@/modules/engagement";
import { money } from "@/shared/kernel";
import { services } from "../container";
import { settleDepositMoney } from "../deposits";
import { availableRails } from "../payments-config";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { currentShop } from "../shop";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const Offer = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  kind: z.enum(DEPOSIT_KINDS),
  title: z.string().max(200),
  blurb: z.string().max(400).default(""),
  deposit: z.number().positive().max(1_000_000),
  credit: z.number().nonnegative().max(1_000_000).default(0),
  price: z.number().positive().max(1_000_000),
  opensAt: z.iso.datetime({ offset: true }),
  closesAt: z.iso.datetime({ offset: true }),
  /** Pre-orders only: when the balance opens (when it ships) and for how many days. */
  balanceFrom: z.iso.datetime({ offset: true }).nullable().default(null),
  balanceDays: z.number().int().min(1).max(30).default(7),
  stock: z.number().int(),
  perPerson: z.number().int(),
});

/** A shop offers a listing as a pre-order, or as an 11.11 pre-sale (balance paid on the day). */
export async function createDepositOfferAction(input: z.input<typeof Offer>): Promise<{ ok: true; offer: SellerDepositOfferView } | Failure> {
  const shop = await currentShop();
  if (!shop) return fail("forbidden", "Open your shop first.");
  const p = Offer.safeParse(input);
  if (!p.success) return fail("invalid_offer", "Check the pre-order and try again.");
  const d = p.data;
  const opensAt = new Date(d.opensAt);
  const closesAt = new Date(d.closesAt);
  // Pre-sales pay the balance on 11.11 (Beijing time); pre-orders when the shop says it ships.
  const festival = festivalWindow(closesAt.getUTCFullYear());
  const balanceFrom = d.kind === "presale" ? festival.from : d.balanceFrom ? new Date(d.balanceFrom) : closesAt;
  const balanceUntil = d.kind === "presale" ? festival.until : new Date(balanceFrom.getTime() + d.balanceDays * 86_400_000);
  const r = await (await services()).deposits.createOffer(shop.sellerId, {
    slug: d.slug,
    kind: d.kind,
    title: d.title,
    blurb: d.blurb,
    deposit: money.fromDollars(d.deposit),
    credit: money.fromDollars(d.kind === "presale" ? d.credit : d.deposit),
    price: money.fromDollars(d.price),
    opensAt,
    closesAt: d.kind === "presale" && closesAt > festival.from ? festival.from : closesAt,
    balanceFrom,
    balanceUntil,
    stock: d.stock,
    perPerson: d.perPerson,
  });
  if (!r.ok) return fail(r.error.code, r.error.message);
  revalidatePath("/drops");
  return { ok: true, offer: r.value };
}

/** The shop calls it off before the balance opens; every paid deposit is refunded. */
export async function cancelDepositOfferAction(offerId: string): Promise<{ ok: true; refunded: number } | Failure> {
  const shop = await currentShop();
  if (!shop) return fail("forbidden", "Open your shop first.");
  const app = await services();
  const r = await app.deposits.cancelOffer(shop.sellerId, z.uuid().catch("").parse(offerId));
  if (!r.ok) return fail(r.error.code, r.error.message);
  for (const d of r.value.refunds) {
    await settleDepositMoney(app, d, "refund");
    await app.notifications.notify([d.buyerId], { kind: "deposit", title: "Pre-order cancelled", body: `${d.title}: the shop cancelled it, so your deposit is coming back.`, link: "/drops#deposits", email: true }, `deposit-cancel:${d.depositId}`);
  }
  revalidatePath("/drops");
  return { ok: true, refunded: r.value.refunds.length };
}

/** A shopper puts a deposit down: it becomes an order of its own to pay now. */
export async function placeDepositAction(offerId: string, country: string): Promise<{ ok: true; invoiceId: string } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in to put a deposit down.");
  if (!(await allow("checkout", account.id))) return RATE_LIMITED;
  const rail = availableRails()[0];
  if (!rail) return fail("rail_unavailable", "Payments are switched off right now.");
  const app = await services();
  const held = await app.deposits.reserve(account.id, z.uuid().catch("").parse(offerId));
  if (!held.ok) return fail(held.error.code, held.error.message);
  const order = await app.depositCheckout({ buyerId: account.id, slug: held.value.offer.slug, amount: held.value.offer.deposit, country: z.string().regex(/^[A-Z]{2}$/).catch("US").parse(country), rail });
  if (!order.ok) {
    await app.deposits.abandon(held.value.deposit.id);
    return fail(order.error.code, order.error.message);
  }
  await app.deposits.attachOrder(held.value.deposit.id, order.value.orderId);
  return { ok: true, invoiceId: order.value.invoiceId };
}
