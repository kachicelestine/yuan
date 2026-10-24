// Applies pending migrations to the Postgres server in DATABASE_URL. Run as a deploy step.
import { serverEnv } from "@/config/server-env";
import { migrateServer } from "@/shared/infrastructure/database";

if (!serverEnv.DATABASE_URL) {
  console.error("DATABASE_URL is not set. (Development without it uses the embedded database, which migrates itself.)");
  process.exit(1);
}
await migrateServer(serverEnv.DATABASE_URL);
console.log("Migrations applied.");
