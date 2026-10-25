import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

/** GET /api/me/unread: unread chats and notifications for the badges. */
export async function GET() {
  const account = await currentAccount();
  if (!account) return Response.json({ chats: 0, notifications: 0 });
  const app = await services();
  const [chats, notifications] = await Promise.all([app.messaging.unread({ side: "buyer", accountId: account.id, name: "" }), app.notifications.unread(account.id)]);
  return Response.json({ chats, notifications }, { headers: { "cache-control": "no-store" } });
}
