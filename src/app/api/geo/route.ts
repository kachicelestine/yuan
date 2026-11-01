import { serverEnv } from "@/config/server-env";
import { clientCountryFrom } from "@/server/client-ip";

/** GET /api/geo — the visitor's country as our edge sees it, so a new shopper starts in the right market. */
export function GET(request: Request) {
  return Response.json({ country: clientCountryFrom(request.headers, serverEnv.TRUST_PROXY) }, { headers: { "cache-control": "private, no-store" } });
}
