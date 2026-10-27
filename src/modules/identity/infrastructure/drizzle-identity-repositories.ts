import { and, count, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Account, Email } from "../domain/account";
import type { AccountRepository, ChallengeRepository, SessionRepository } from "../domain/repositories";
import type { EmailChallenge, Session } from "../domain/sign-in";
import type { WalletChallenge } from "../domain/wallet";
import { accounts, emailChallenges, sessions, walletChallenges } from "./schema";

const toAccount = (r: typeof accounts.$inferSelect): Account => r;

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const [r] = await this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return r ? toAccount(r) : null;
  }

  async findByEmail(email: Email) {
    const [r] = await this.db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    return r ? toAccount(r) : null;
  }

  async findByWallet(address: string) {
    const [r] = await this.db
      .select()
      .from(accounts)
      .where(sql`lower(${accounts.wallet}) = ${address.toLowerCase()}`)
      .limit(1);
    return r ? toAccount(r) : null;
  }

  async setSuspension(id: string, at: Date | null, reason: string | null) {
    await this.db.update(accounts).set({ suspendedAt: at, suspendReason: reason }).where(eq(accounts.id, id));
  }

  async save(a: Account) {
    await this.db
      .insert(accounts)
      .values(a)
      .onConflictDoUpdate({ target: accounts.id, set: { email: a.email, wallet: a.wallet } });
  }
}

export class DrizzleChallengeRepository implements ChallengeRepository {
  constructor(private readonly db: Database) {}

  async findEmailChallenge(id: string) {
    const [r] = await this.db.select().from(emailChallenges).where(eq(emailChallenges.id, id)).limit(1);
    return r ? ({ ...r, email: r.email as Email } satisfies EmailChallenge) : null;
  }

  async countEmailChallengesSince(email: Email, since: Date) {
    const [r] = await this.db
      .select({ n: count() })
      .from(emailChallenges)
      .where(and(eq(emailChallenges.email, email), gte(emailChallenges.createdAt, since)));
    return r?.n ?? 0;
  }

  async saveEmailChallenge(c: EmailChallenge) {
    await this.db
      .insert(emailChallenges)
      .values(c)
      .onConflictDoUpdate({ target: emailChallenges.id, set: { attempts: c.attempts, consumedAt: c.consumedAt } });
  }

  async findWalletChallenge(nonce: string) {
    const [r] = await this.db.select().from(walletChallenges).where(eq(walletChallenges.nonce, nonce)).limit(1);
    return (r as WalletChallenge | undefined) ?? null;
  }

  async saveWalletChallenge(c: WalletChallenge) {
    await this.db
      .insert(walletChallenges)
      .values(c)
      .onConflictDoUpdate({ target: walletChallenges.nonce, set: { consumedAt: c.consumedAt } });
  }
}

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async findByTokenHash(tokenHash: string) {
    const [r] = await this.db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
    return (r as Session | undefined) ?? null;
  }

  async save(s: Session) {
    await this.db.insert(sessions).values(s).onConflictDoUpdate({ target: sessions.id, set: { expiresAt: s.expiresAt } });
  }

  async delete(id: string) {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteForAccount(accountId: string) {
    await this.db.delete(sessions).where(eq(sessions.accountId, accountId));
  }
}
