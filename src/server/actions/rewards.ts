"use server";

import { z } from "zod";
import type { RewardsView } from "@/modules/engagement";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };

/** Pays a finished mission's coins, once. */
export async function claimMissionAction(missionId: string): Promise<{ ok: true; coins: number; view: RewardsView } | Failure> {
  const account = await currentAccount();
  if (!account) return { ok: false, code: "sign_in_required", message: "Sign in to earn coins." };
  if (!(await allow("account.write", account.id))) return RATE_LIMITED;
  const r = await (await services()).rewards.claim(account.id, z.string().max(40).catch("").parse(missionId));
  return r.ok ? { ok: true, coins: r.value.coins, view: r.value.view } : { ok: false, code: r.error.code, message: r.error.message };
}
