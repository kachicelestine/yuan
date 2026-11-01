import type { Account, Email } from "./account";
import type { EmailChallenge, Session } from "./sign-in";
import type { WalletChallenge } from "./wallet";

export interface AccountRepository {
  findById(id: string): Promise<Account | null>;
  findByEmail(email: Email): Promise<Account | null>;
  findByWallet(address: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
  setSuspension(id: string, at: Date | null, reason: string | null): Promise<void>;
  /** Removes the sign-in details for good; the row stays so old orders still point somewhere. */
  close(id: string, at: Date): Promise<void>;
  marketOf(id: string): Promise<string | null>;
  setMarket(id: string, code: string): Promise<void>;
}

export interface ChallengeRepository {
  findEmailChallenge(id: string): Promise<EmailChallenge | null>;
  /** How many codes this email was sent since `since`, for rate limiting. */
  countEmailChallengesSince(email: Email, since: Date): Promise<number>;
  saveEmailChallenge(c: EmailChallenge): Promise<void>;
  findWalletChallenge(nonce: string): Promise<WalletChallenge | null>;
  saveWalletChallenge(c: WalletChallenge): Promise<void>;
}

export interface SessionRepository {
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
  /** Ends every session of an account (signs it out everywhere). */
  deleteForAccount(accountId: string): Promise<void>;
}
