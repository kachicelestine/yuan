import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { openDatabase } from "./database";

describe("openDatabase", () => {
  const roots: string[] = [];
  afterAll(() => Promise.all(roots.map((r) => rm(r, { recursive: true, force: true }))));

  it("creates missing parent folders for an embedded database, as on a fresh clone", async () => {
    const root = await mkdtemp(join(tmpdir(), "lychee-db-"));
    roots.push(root);
    const db = await openDatabase({ kind: "embedded", dataDir: join(root, "not", "there", "pglite") });
    const rows = await db.execute(sql`select count(*)::int as n from markets.countries`);
    expect(rows).toBeTruthy();
    await (db as unknown as { $client: { close(): Promise<void> } }).$client.close();
    // On disk, every migration is written through to files: slow on Windows, slower with the whole suite running.
  }, 90_000);
});
