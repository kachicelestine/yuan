import { services } from "@/server/container";
import { allow, clientIp } from "@/server/rate-limits";

/**
 * POST /api/ads/click: someone tapped a sponsored listing. The body is the token the
 * impression came with (sent with sendBeacon, so plain text); the shop pays once per
 * impression, at the price signed into it.
 */
export async function POST(request: Request) {
  if (!(await allow("ads.click", await clientIp()))) return new Response(null, { status: 204 });
  const token = (await request.text()).trim().slice(0, 2000);
  if (!token) return Response.json({ error: "invalid_input" }, { status: 400 });
  const r = await (await services()).ads.click(token);
  return Response.json({ billed: r.billed });
}
