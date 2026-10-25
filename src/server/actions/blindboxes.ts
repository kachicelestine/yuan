"use server";

import { revalidatePath, updateTag } from "next/cache";
import { productTag } from "../cache-tags";
import { z } from "zod";
import type { MachineView, SellerSeriesView } from "@/modules/engagement";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";
import { currentShop } from "../shop";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

const Case = z.uuid().catch("");
const Index = z.number().int().min(0).max(99).catch(-1);

async function signedIn() {
  const account = await currentAccount();
  if (!account) return { error: fail("sign_in_required", "Sign in to pick a box.") } as const;
  if (!(await allow("account.write", account.id))) return { error: RATE_LIMITED } as const;
  return { account, app: await services() } as const;
}

/** Holds a box while the shopper checks out; the bag gets the listing at its price. */
export async function pickBoxAction(caseId: string, index: number): Promise<{ ok: true; view: MachineView; line: { slug: string; title: string; image: string; unitPrice: number; note: string } } | Failure> {
  const s = await signedIn();
  if ("error" in s) return s.error!;
  const r = await s.app.blindBoxes.pick(s.account.id, Case.parse(caseId), Index.parse(index));
  if (!r.ok) return fail(r.error.code, r.error.message);
  const [p] = await s.app.catalog.getProductsBySlugs([r.value.slug]);
  if (!p || p.price === undefined) return fail("unknown_product", "This box isn't for sale right now.");
  return { ok: true, view: r.value.view, line: { slug: p.slug, title: `${r.value.view.series.title} blind box`, image: r.value.view.series.poster, unitPrice: p.price, note: `Box ${Index.parse(index) + 1} from case #${r.value.caseNumber}, held 30 min` } };
}

export async function releaseBoxAction(caseId: string, index: number): Promise<{ ok: true } | Failure> {
  const s = await signedIn();
  if ("error" in s) return s.error!;
  await s.app.blindBoxes.release(s.account.id, Case.parse(caseId), Index.parse(index));
  return { ok: true };
}

/** One hint: a figure this box doesn't hold. */
export async function shakeBoxAction(caseId: string, index: number): Promise<{ ok: true; figureId: string | null; view: MachineView } | Failure> {
  const s = await signedIn();
  if ("error" in s) return s.error!;
  const r = await s.app.blindBoxes.shake(s.account.id, Case.parse(caseId), Index.parse(index));
  return r.ok ? { ok: true, ...r.value } : fail(r.error.code, r.error.message);
}

/** Opens a box the shopper paid for. */
export async function openBoxAction(caseId: string, index: number): Promise<{ ok: true; figureId: string } | Failure> {
  const s = await signedIn();
  if ("error" in s) return s.error!;
  const r = await s.app.blindBoxes.open(s.account.id, Case.parse(caseId), Index.parse(index));
  return r.ok ? { ok: true, figureId: r.value.figureId } : fail(r.error.code, r.error.message);
}

const SeriesForm = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  title: z.string().max(120),
  figures: z.array(z.object({ name: z.string().max(80), image: z.string().min(1).max(300), secret: z.boolean() })).min(2).max(25),
  secretOdds: z.number().int().min(1).max(100_000),
  shakesPerCase: z.number().int().min(0).max(5),
});

/** A shop starts selling one of its listings as blind boxes. */
export async function createBoxSeriesAction(input: z.input<typeof SeriesForm>): Promise<{ ok: true; series: SellerSeriesView } | Failure> {
  const shop = await currentShop();
  if (!shop) return fail("forbidden", "Open your shop first.");
  const p = SeriesForm.safeParse(input);
  if (!p.success) return fail("invalid_series", "Check the series: 2 to 24 figures, each with a name and a photo.");
  const r = await (await services()).blindBoxes.createSeries(shop.sellerId, p.data);
  if (!r.ok) return fail(r.error.code, r.error.message);
  // The listing's page links to its box machine.
  updateTag(productTag(r.value.slug));
  revalidatePath("/unbox");
  return { ok: true, series: r.value };
}

export async function setBoxSeriesActiveAction(seriesId: string, active: boolean): Promise<{ ok: true; series: SellerSeriesView } | Failure> {
  const shop = await currentShop();
  if (!shop) return fail("forbidden", "Open your shop first.");
  const r = await (await services()).blindBoxes.setActive(shop.sellerId, z.string().max(80).catch("").parse(seriesId), active === true);
  if (!r.ok) return fail(r.error.code, r.error.message);
  updateTag(productTag(r.value.slug));
  revalidatePath("/unbox");
  return { ok: true, series: r.value };
}
