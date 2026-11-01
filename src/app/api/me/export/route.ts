import { exportAccount } from "@/server/account-closure";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

/** GET /api/me/export — everything we hold about the signed-in person, as a file to keep. */
export async function GET() {
  const account = await currentAccount();
  if (!account) return Response.json({ error: "signed_out" }, { status: 401 });
  const data = await exportAccount(await services(), account.id, { email: account.email ?? null, wallet: account.wallet ?? null });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="my-data.json"`,
      "cache-control": "no-store",
    },
  });
}
