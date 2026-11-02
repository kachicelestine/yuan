"use server";

import { z } from "zod";
import type { MessageView } from "@/modules/messaging";
import { actorFor } from "../actor";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { currentShop } from "../shop";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const Text = z.string().max(4000);
const Slug = z.string().regex(/^[a-z0-9-]{1,80}$/).nullable();
const Photo = z.string().regex(/^chat\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/).nullable();
const PhotoFile = z.object({ contentType: z.string().max(100), bytes: z.number().int() });

/** Step 1 of sending a photo: a ticket to upload it to private storage. */
export async function startChatPhotoAction(file: { contentType: string; bytes: number }): Promise<{ ok: true; url: string; method: "PUT"; headers: Readonly<Record<string, string>>; photo: string } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in to send photos.");
  if (!(await allow("content.upload", account.id))) return RATE_LIMITED;
  const f = PhotoFile.safeParse(file);
  if (!f.success) return fail("unsupported_type", "Send a JPEG, PNG or WebP photo.");
  const r = await (await services()).messaging.startPhoto(account.id, f.data);
  return r.ok ? { ok: true, ...r.value } : fail(r.error.code, r.error.message);
}

/** A shopper writes to a shop (the first message starts the conversation). */
export async function sendToShopAction(sellerId: string, text: string, productSlug: string | null, photo: string | null = null): Promise<{ ok: true; conversationId: string; message: MessageView } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("sign_in_required", "Sign in to message shops.");
  if (!(await allow("content.post", account.id))) return RATE_LIMITED;
  const shop = z.string().regex(/^[a-z0-9-]{1,60}$/).safeParse(sellerId);
  if (!shop.success) return fail("not_found", "No such shop.");
  const r = await (await services()).messaging.toShop(await actorFor(account), shop.data, Text.catch("").parse(text), Slug.catch(null).parse(productSlug), Photo.catch(null).parse(photo));
  return r.ok ? { ok: true, ...r.value } : fail(r.error.code, r.error.message);
}

/** Someone at the shop replies. */
export async function replyAsShopAction(conversationId: string, text: string, productSlug: string | null, photo: string | null = null): Promise<{ ok: true; message: MessageView } | Failure> {
  const s = await currentShop();
  if (!s) return fail("forbidden", "Open your shop first.");
  if (!(await allow("content.post", s.account.id))) return RATE_LIMITED;
  const r = await (await services()).messaging.reply(z.uuid().catch("").parse(conversationId), { side: "shop", accountId: s.account.id, sellerId: s.sellerId }, Text.catch("").parse(text), Slug.catch(null).parse(productSlug), Photo.catch(null).parse(photo));
  return r.ok ? { ok: true, message: r.value } : fail(r.error.code, r.error.message);
}
