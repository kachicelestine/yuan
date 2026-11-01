"use server";

import { z } from "zod";
import { serverEnv } from "@/config/server-env";
import { allow, clientIp, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { translateText } from "../translate";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const Input = z.object({ text: z.string().trim().min(1).max(2000), language: z.string().regex(/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/) });

/** Something a person wrote, in the reader's language. Each new text costs model tokens, so it's limited per person. */
export async function translateAction(text: string, language: string): Promise<{ ok: true; text: string } | Failure> {
  if (!serverEnv.ANTHROPIC_API_KEY) return fail("off", "Translation isn't switched on.");
  const input = Input.safeParse({ text, language });
  if (!input.success) return fail("invalid", "That couldn't be translated.");
  const account = await currentAccount();
  if (!(await allow("translate", account?.id ?? (await clientIp())))) return RATE_LIMITED;
  try {
    const translated = await translateText(input.data.text, input.data.language);
    return translated ? { ok: true, text: translated } : fail("unavailable", "That couldn't be translated.");
  } catch {
    return fail("unavailable", "Translation isn't available right now.");
  }
}
