import { cookies } from "next/headers";
import { z } from "zod";
import { serverEnv } from "@/config/server-env";
import { services } from "@/server/container";
import { allow, clientIp } from "@/server/rate-limits";
import { REFERRAL_COOKIE, REFERRAL_MAX_AGE, referralValue } from "@/server/referrals";

const Body = z.object({
  code: z.string().regex(/^[a-z2-9]{7}$/),
  /** The page the link opened, e.g. /p/solar-panel-450w-bifacial. */
  path: z.string().max(300).default("/"),
});

/**
 * POST /api/ref: someone followed a creator link. Counts the click and remembers the
 * creator for the attribution window (last link wins). Unknown codes change nothing.
 */
export async function POST(request: Request) {
  if (!(await allow("ref", await clientIp()))) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const { code, path } = parsed.data;
  const slug = /^\/p\/([a-z0-9-]{1,80})$/.exec(path)?.[1] ?? null;
  const app = await services();
  if (!(await app.affiliates.click(code, slug))) return Response.json({ ok: false }, { status: 404 });
  (await cookies()).set(REFERRAL_COOKIE, referralValue(code, new Date()), {
    maxAge: REFERRAL_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv.NODE_ENV === "production",
    path: "/",
  });
  return Response.json({ ok: true });
}
