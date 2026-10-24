import { accountData } from "@/server/account-data";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

/**
 * GET /api/account — the signed-in buyer's bag, lists, coupons and coins, so a device
 * can mirror them. Signed out, it says so and nothing else.
 */
export async function GET() {
  const account = await currentAccount();
  const headers = { "cache-control": "no-store" };
  if (!account) return Response.json({ signedIn: false }, { headers });
  const state = await accountData(await services()).load(account.id);
  return Response.json({ signedIn: true, state }, { headers });
}
