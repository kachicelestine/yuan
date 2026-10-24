"use server";

import { z } from "zod";
import { MAX_LINES, MAX_QTY, SHIPPING_METHODS } from "@/modules/ordering";
import { services } from "../container";
import { currentAccount } from "../session";

const Input = z.object({
  lines: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
        option: z.string().trim().max(120).nullable(),
        qty: z.number().int().min(1).max(MAX_QTY),
      }),
    )
    .min(1)
    .max(MAX_LINES),
  country: z.string().regex(/^[A-Z]{2}$/),
  shippingMethod: z.enum(SHIPPING_METHODS),
  combineParcels: z.boolean(),
  payDutiesNow: z.boolean(),
  couponId: z.string().max(40).nullable(),
  rail: z.string().max(40),
});

export type CheckoutInput = z.input<typeof Input>;

export type CheckoutOutcome =
  | { ok: true; orderNumber: string; invoiceId: string; total: number }
  | { ok: false; code: string; message: string };

/**
 * Places an order from the bag. Callable by anyone with a POST, so it trusts nothing:
 * the input is validated here and every price is recomputed by the checkout use case.
 */
export async function checkoutAction(input: CheckoutInput): Promise<CheckoutOutcome> {
  const account = await currentAccount();
  if (!account) return { ok: false, code: "sign_in_required", message: "Sign in to place your order." };
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input", message: "Something in your bag looks wrong. Refresh and try again." };
  const r = await (await services()).checkout({ ...parsed.data, buyerId: account.id });
  if (!r.ok) return { ok: false, code: r.error.code, message: r.error.message };
  return { ok: true, orderNumber: r.value.orderNumber, invoiceId: r.value.invoiceId, total: r.value.pricing.total / 100 };
}
