import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * Any Drizzle Postgres database, whichever driver backs it (postgres-js in production,
 * PGlite in development and tests). Repositories depend on this, never on a driver.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories query tables directly, not the relational API
export type Database = PgDatabase<PgQueryResultHKT, any>;

export type DatabaseTarget =
  /** A Postgres server, e.g. postgres://user:pass@host:5432/db */
  | { kind: "postgres"; url: string; maxConnections?: number }
  /** Embedded Postgres saved in a folder, for local development. */
  | { kind: "embedded"; dataDir: string }
  /** Embedded Postgres in memory, for builds and tests. */
  | { kind: "memory" };

const MIGRATIONS = { migrationsFolder: "drizzle", migrationsSchema: "public" };

/**
 * Opens a database and, for embedded targets, applies migrations so it's ready to use.
 * Server databases are migrated by `pnpm db:migrate` as a deploy step instead.
 */
export async function openDatabase(target: DatabaseTarget): Promise<Database> {
  if (target.kind === "postgres") {
    const [{ drizzle }, { default: postgres }] = await Promise.all([import("drizzle-orm/postgres-js"), import("postgres")]);
    return drizzle({ client: postgres(target.url, { max: target.maxConnections ?? 10 }), casing: "snake_case" });
  }

  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([import("@electric-sql/pglite"), import("drizzle-orm/pglite"), import("drizzle-orm/pglite/migrator")]);
  if (target.kind === "embedded") {
    // PGlite creates its own folder but not the parents (e.g. .data/ on a fresh clone).
    const { mkdir } = await import("node:fs/promises");
    await mkdir(target.dataDir, { recursive: true });
  }
  const client = target.kind === "embedded" ? new PGlite(target.dataDir) : new PGlite();
  const db = drizzle({ client, casing: "snake_case" });
  try {
    await migrate(db, MIGRATIONS);
  } catch (error) {
    // Drizzle reports only the SQL that failed; the reason is in the cause.
    throw new Error(`Couldn't open the ${target.kind} database: ${reason(error)}`, { cause: error });
  }
  return db;
}

function reason(error: unknown): string {
  const cause = (error as { cause?: unknown })?.cause;
  if (cause) return reason(cause);
  return error instanceof Error ? error.message : String(error);
}

/** Applies migrations added since an embedded database was opened (development hot reload). */
export async function migrateEmbedded(db: Database) {
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db as Parameters<typeof migrate>[0], MIGRATIONS);
}

/** Applies pending migrations to a Postgres server. */
export async function migrateServer(url: string) {
  const [{ drizzle }, { migrate }, { default: postgres }] = await Promise.all([import("drizzle-orm/postgres-js"), import("drizzle-orm/postgres-js/migrator"), import("postgres")]);
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle({ client, casing: "snake_case" }), MIGRATIONS);
  } finally {
    await client.end();
  }
}
