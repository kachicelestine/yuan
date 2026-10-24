import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { assertServerReady } from "./db";
import { seedAll } from "./seed";

describe("a Postgres server that was prepared by hand", () => {
  let db: Database;

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
  });

  it("asks for `pnpm db:seed` when migrated but empty", async () => {
    await expect(assertServerReady(db)).rejects.toThrow("Run `pnpm db:seed`");
  });

  it("passes once seeded", async () => {
    await seedAll(db);
    await expect(assertServerReady(db)).resolves.toBeUndefined();
  });

  it("asks for `pnpm db:migrate` when a migration is missing", async () => {
    await db.execute(sql`delete from "public"."__drizzle_migrations" where id = (select max(id) from "public"."__drizzle_migrations")`);
    await expect(assertServerReady(db)).rejects.toThrow("1 migration behind. Run `pnpm db:migrate`");
  });
});
