import "server-only";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { serverEnv } from "@/config/server-env";
import { countries } from "@/modules/markets/infrastructure/schema";
import { migrateEmbedded, openDatabase, type Database, type DatabaseTarget } from "@/shared/infrastructure/database";
import { seedAll } from "./seed";

/**
 * Picks where data lives:
 * - DATABASE_URL set: that Postgres server (migrated by `pnpm db:migrate`, seeded by `pnpm db:seed`).
 * - `next dev` without it: embedded Postgres in .data/pglite, kept between restarts.
 * - builds, `next start` and tests without it: a fresh in-memory copy per process,
 *   because several build workers can't share one embedded folder.
 */
function target(): DatabaseTarget {
  if (serverEnv.DATABASE_URL) return { kind: "postgres", url: serverEnv.DATABASE_URL };
  const building = process.env.NEXT_PHASE === "phase-production-build";
  // `next dev` runs generateStaticParams in short-lived worker processes. The embedded
  // folder belongs to the dev server's own process (PGlite can't be shared between
  // processes), so a worker gets a private, freshly seeded in-memory copy instead.
  const devWorker = /[\\/]jest-worker[\\/]processChild\.js$/.test(process.argv[1] ?? "");
  if (serverEnv.NODE_ENV === "development" && !building && !devWorker) return { kind: "embedded", dataDir: ".data/pglite" };
  if (serverEnv.NODE_ENV === "production" && !building) {
    console.warn("[db] DATABASE_URL is not set; using an in-memory database. Data will not survive a restart.");
  }
  return { kind: "memory" };
}

/** How many migrations exist in drizzle/. 0 when the folder isn't deployed alongside the app. */
function migrationCount() {
  try {
    return (JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] }).entries.length;
  } catch {
    return 0;
  }
}

const pgCode = (error: unknown) => {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code;
};

async function appliedMigrations(db: Database) {
  try {
    const result = await db.execute(sql`select count(*)::int as n from "public"."__drizzle_migrations"`);
    // postgres-js returns the rows; PGlite wraps them.
    const rows = (Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows) as { n: number }[];
    return rows[0]?.n ?? 0;
  } catch (error) {
    if (pgCode(error) === "42P01") return 0; // No migrations table: never migrated.
    throw error;
  }
}

/** Embedded databases migrate and seed themselves; a server is prepared by hand, so check it was. */
async function prepare(db: Database, t: DatabaseTarget) {
  if (t.kind === "postgres") return assertServerReady(db);
  await migrateEmbedded(db);
  await seedAll(db);
}

/** Names the command to run when a server isn't migrated or seeded, instead of failing later somewhere obscure. */
export async function assertServerReady(db: Database) {
  const behind = migrationCount() - (await appliedMigrations(db));
  if (behind > 0) throw new Error(`The database in DATABASE_URL is ${behind} migration${behind === 1 ? "" : "s"} behind. Run \`pnpm db:migrate\`.`);
  if ((await db.$count(countries)) === 0) throw new Error("The database in DATABASE_URL has no countries yet. Run `pnpm db:seed` to load them and the sample catalog.");
}

// One connection per process, kept on globalThis so dev hot reloads reuse it.
const globalForDb = globalThis as typeof globalThis & {
  __lycheeDb?: { key: string; db: Promise<Database> };
  __lycheeReady?: { migrations: number; done: Promise<void> };
};

export async function getDb(): Promise<Database> {
  const t = target();
  const key = JSON.stringify(t);
  if (globalForDb.__lycheeDb?.key !== key) {
    const db = openDatabase(t).catch((error) => {
      globalForDb.__lycheeDb = undefined;
      throw error;
    });
    globalForDb.__lycheeDb = { key, db };
    globalForDb.__lycheeReady = undefined;
  }
  const db = await globalForDb.__lycheeDb.db;

  // Prepared once per process. In development, again whenever a migration is generated, so
  // the next request applies it (embedded) or asks for `pnpm db:migrate` (server) without a restart.
  const migrations = serverEnv.NODE_ENV === "development" ? migrationCount() : -1;
  if (globalForDb.__lycheeReady?.migrations !== migrations) {
    const done: Promise<void> = prepare(db, t).catch((error) => {
      // Check again on the next request (e.g. after `pnpm db:seed`).
      if (globalForDb.__lycheeReady?.done === done) globalForDb.__lycheeReady = undefined;
      throw error;
    });
    globalForDb.__lycheeReady = { migrations, done };
  }
  await globalForDb.__lycheeReady.done;
  return db;
}
