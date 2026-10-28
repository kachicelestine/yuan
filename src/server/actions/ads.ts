"use server";

import { z } from "zod";
import type { CampaignView } from "@/modules/ads";
import { money } from "@/shared/kernel";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentShop } from "../shop";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const dollars = z.number().positive().max(100_000);
const Campaign = z.object({
  name: z.string().trim().min(1).max(60),
  slugs: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).min(1).max(20),
  bid: dollars,
  dailyBudget: dollars,
});
const Patch = Campaign.partial().extend({ status: z.enum(["active", "paused"]).optional() });

async function owner() {
  const s = await currentShop();
  if (!s) return { allowed: false as const, error: fail("forbidden", "Open your shop first.") };
  if (s.role !== "owner") return { allowed: false as const, error: fail("forbidden", "Only the shop's owner can spend on ads.") };
  if (!(await allow("account.write", s.account.id))) return { allowed: false as const, error: RATE_LIMITED as Failure };
  return { allowed: true as const, ...s, app: await services() };
}

export async function createCampaignAction(input: z.input<typeof Campaign>): Promise<{ ok: true; campaign: CampaignView } | Failure> {
  const s = await owner();
  if (!s.allowed) return s.error;
  const p = Campaign.safeParse(input);
  if (!p.success) return fail("invalid", "Check the name, listings, bid and budget.");
  const r = await s.app.ads.create(s.sellerId, { ...p.data, bid: money.fromDollars(p.data.bid), dailyBudget: money.fromDollars(p.data.dailyBudget) });
  return r.ok ? { ok: true, campaign: r.value } : fail(r.error.code, r.error.message);
}

export async function updateCampaignAction(id: string, patch: z.input<typeof Patch>): Promise<{ ok: true; campaign: CampaignView } | Failure> {
  const s = await owner();
  if (!s.allowed) return s.error;
  const p = Patch.safeParse(patch);
  const campaignId = z.uuid().safeParse(id);
  if (!p.success || !campaignId.success) return fail("invalid", "That change doesn't look right.");
  const { bid, dailyBudget, ...rest } = p.data;
  const r = await s.app.ads.update(s.sellerId, campaignId.data, {
    ...rest,
    ...(bid !== undefined ? { bid: money.fromDollars(bid) } : {}),
    ...(dailyBudget !== undefined ? { dailyBudget: money.fromDollars(dailyBudget) } : {}),
  });
  return r.ok ? { ok: true, campaign: r.value } : fail(r.error.code, r.error.message);
}

const Boost = z.object({ videoId: z.string().min(1).max(64), bid: dollars, dailyBudget: dollars });

/** Boosts a video of one of the shop's products into For You as a sponsored slide, paid per tap. */
export async function boostVideoAction(input: z.input<typeof Boost>): Promise<{ ok: true; campaign: CampaignView } | Failure> {
  const s = await owner();
  if (!s.allowed) return s.error;
  const p = Boost.safeParse(input);
  if (!p.success) return fail("invalid", "Check the video, bid and budget.");
  const r = await s.app.ads.boost(s.sellerId, { videoId: p.data.videoId, bid: money.fromDollars(p.data.bid), dailyBudget: money.fromDollars(p.data.dailyBudget) });
  return r.ok ? { ok: true, campaign: r.value } : fail(r.error.code, r.error.message);
}
