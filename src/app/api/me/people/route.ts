import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

/** GET /api/me/people — the signed-in person's handle, and the handles of the people they follow. */
export async function GET() {
  const account = await currentAccount();
  if (!account) return Response.json({ me: null, handles: [] }, { headers: { "cache-control": "private, no-store" } });
  const app = await services();
  const [me, actors] = await Promise.all([app.profiles.me(account.id), app.profiles.followingIds(account.id).then((ids) => app.profiles.actors(ids))]);
  return Response.json({ me: me.handle, handles: [...actors.values()].map((a) => a.handle) }, { headers: { "cache-control": "private, no-store" } });
}
