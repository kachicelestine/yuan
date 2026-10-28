import { eq, inArray } from "drizzle-orm";
import { accounts } from "@/modules/identity/infrastructure/schema";
import type { Database } from "@/shared/infrastructure/database";

/** Sign-in emails of these accounts (accounts that sign in with a wallet have none). */
export async function accountEmails(db: Database, ids: readonly string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: accounts.id, email: accounts.email }).from(accounts).where(inArray(accounts.id, [...ids]));
  return new Map(rows.flatMap((r) => (r.email ? [[r.id, r.email] as [string, string]] : [])));
}

/** The account that signs in with this email, if any. */
export async function accountIdByEmail(db: Database, email: string): Promise<string | null> {
  const [r] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email.trim().toLowerCase())).limit(1);
  return r?.id ?? null;
}
