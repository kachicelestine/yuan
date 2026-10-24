// Loads countries, exchange rates and the sample catalog into DATABASE_URL. Safe to re-run.
import { serverEnv } from "@/config/server-env";
import { seedAll } from "@/server/seed";
import { openDatabase } from "@/shared/infrastructure/database";

if (!serverEnv.DATABASE_URL) {
  console.error("DATABASE_URL is not set. (Development without it uses the embedded database, which seeds itself.)");
  process.exit(1);
}
const db = await openDatabase({ kind: "postgres", url: serverEnv.DATABASE_URL, maxConnections: 1 });
console.log(await seedAll(db));
process.exit(0);
