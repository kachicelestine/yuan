import { defineConfig } from "drizzle-kit";

// Each bounded context declares its tables in its own infrastructure/schema.ts, inside
// its own Postgres schema (markets, catalog, …); shared platform tables (outbox,
// schedules, rate limits) live in the "platform" schema.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/modules/*/infrastructure/schema.ts", "./src/shared/infrastructure/platform-schema.ts"],
  out: "./drizzle",
  casing: "snake_case",
  strict: true,
  verbose: true,
  ...(process.env.DATABASE_URL ? { dbCredentials: { url: process.env.DATABASE_URL } } : { driver: "pglite", dbCredentials: { url: ".data/pglite" } }),
});
