import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

/** GET /api/me/videos — the signed-in creator's videos in any state (processing, in review, live). */
export async function GET() {
  const account = await currentAccount();
  if (!account) return Response.json({ videos: [] }, { status: 401, headers: { "cache-control": "private, no-store" } });
  return Response.json({ videos: await (await services()).uploads.mine(account.id) }, { headers: { "cache-control": "private, no-store" } });
}
