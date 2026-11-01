// `pnpm db:samples` shows whether the sample shops are visible; `hide` takes them and their
// listings off the site, `show` brings them back. Nothing is deleted, and shops that were
// suspended for any other reason are left alone.
import { serverEnv } from "@/config/server-env";
import { sellers } from "@/fixtures/sellers";
import { CATALOG_TAG, CONTENT_TAG, FEED_TAG, LIVE_TAG, PROMOS_TAG, RANKINGS_TAG } from "@/server/cache-tags";
import { services } from "@/server/container";
import { revalidateTags } from "@/server/internal";

const REASON = "Sample shop hidden before launch.";
const command = process.argv[2] ?? "status";

if (!["status", "hide", "show"].includes(command)) {
  console.error("Use: pnpm db:samples [status|hide|show]");
  process.exit(1);
}
if (!serverEnv.DATABASE_URL) {
  console.error("DATABASE_URL is not set, so there's no server to change.");
  process.exit(1);
}

const app = await services();
let visible = 0;
let hidden = 0;
let listings = 0;
for (const id of Object.keys(sellers)) {
  const suspension = await app.catalog.suspension(id);
  if (command === "status") {
    if (suspension) hidden++;
    else visible++;
  } else if (command === "hide" && !suspension) {
    const r = await app.catalogAdmin.suspendShop(id, REASON, new Date());
    if (r.ok) listings += r.value.listings;
    hidden++;
  } else if (command === "show" && suspension?.reason === REASON) {
    const r = await app.catalogAdmin.restoreShop(id);
    if (r.ok) listings += r.value.listings;
    visible++;
  }
}

if (command === "status") {
  console.log(`Sample shops: ${visible} visible, ${hidden} hidden.`);
} else {
  console.log(`${command === "hide" ? "Hid" : "Restored"} ${command === "hide" ? hidden : visible} sample shops and ${listings} listings.`);
  await revalidateTags([CATALOG_TAG, CONTENT_TAG, FEED_TAG, LIVE_TAG, PROMOS_TAG, RANKINGS_TAG]).catch(() => console.log("Couldn't refresh the live site's cache; it will catch up on the next deploy."));
}
process.exit(0);
