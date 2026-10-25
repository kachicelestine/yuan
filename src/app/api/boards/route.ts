import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

/** GET /api/boards: your boards (for "Add to board"), newest first. */
export async function GET() {
  const account = await currentAccount();
  if (!account) return Response.json({ signedIn: false, boards: [] }, { headers: { "cache-control": "no-store" } });
  const boards = await (await services()).boards.mine(account.id);
  return Response.json({ signedIn: true, boards }, { headers: { "cache-control": "no-store" } });
}
