import type { Account, Email } from "./account";
import type { EmailChallenge, Session } from "./sign-in";
import type { WalletChallenge } from "./wallet";

export interface AccountRepository {
  findById(id: string): Promise<Account | null>;
  findByEmail(email: Email): Promise<Account | null>;
  findByWallet(address: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
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
}
