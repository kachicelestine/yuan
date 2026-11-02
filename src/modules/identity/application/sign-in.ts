import { domainError, err, ok, type Clock, type DomainError, type Result } from "@/shared/kernel";
import { accountLabel, parseEmail, type Account } from "../domain/account";
import type { AccountRepository, ChallengeRepository, SessionRepository } from "../domain/repositories";
import { attempt, CODES_PER_HOUR, issueChallenge, isLive, openSession, refreshed, type ChallengeError } from "../domain/sign-in";
import { consumeWalletChallenge, issueWalletChallenge, parseAddress, type WalletError } from "../domain/wallet";
import type { Mailer, Secrets, SignatureVerifier, UnitOfWork } from "./ports";

export type AccountView = { id: string; email: string | null; wallet: string | null; label: string };

export const toAccountView = (a: Account): AccountView => ({ id: a.id, email: a.email, wallet: a.wallet, label: accountLabel(a) });

export type SignedIn = { token: string; expiresAt: Date; account: AccountView };

type Repos = { accounts: AccountRepository; challenges: ChallengeRepository; sessions: SessionRepository };

export type IdentityDeps = Repos & {
  uow: UnitOfWork<Repos>;
  secrets: Secrets;
  mailer: Mailer;
  verifier: SignatureVerifier;
  clock: Clock;
  newId: () => string;
  /** Show the code on screen instead of relying on email (local development only). */
  revealCodes: boolean;
};

export function makeIdentity(d: IdentityDeps) {
  const suspended = () => err(domainError("suspended", "This account is suspended. Write to support if you think that's a mistake."));

  async function startSession(scope: Repos, account: Account): Promise<SignedIn> {
    const token = d.secrets.newToken();
    const session = openSession({ id: d.newId(), tokenHash: d.secrets.hashToken(token), accountId: account.id, at: d.clock.now() });
    await scope.sessions.save(session);
    return { token, expiresAt: session.expiresAt, account: toAccountView(account) };
  }

  return {
    /** Emails a one-time code. Says nothing about whether the email has an account. */
    async requestEmailCode(rawEmail: string): Promise<Result<{ challengeId: string; devCode: string | null }, DomainError<"invalid_email" | "rate_limited">>> {
      const email = parseEmail(rawEmail);
      if (!email.ok) return email;
      const now = d.clock.now();
      const recent = await d.challenges.countEmailChallengesSince(email.value, new Date(now.getTime() - 60 * 60_000));
      if (recent >= CODES_PER_HOUR) return err(domainError("rate_limited", "Too many codes for this email. Try again in an hour."));

      const id = d.newId();
      const code = d.secrets.newCode();
      await d.challenges.saveEmailChallenge(issueChallenge({ id, email: email.value, codeHash: d.secrets.hashCode(code, id), at: now }));
      if (!d.revealCodes) await d.mailer.sendSignInCode(email.value, code);
      return ok({ challengeId: id, devCode: d.revealCodes ? code : null });
    },

    /** Checks the code; signs in, creating the account on first use. */
    async verifyEmailCode(challengeId: string, code: string): Promise<Result<SignedIn, ChallengeError | DomainError<"not_found" | "suspended">>> {
      return d.uow.run(async (scope) => {
        const challenge = await scope.challenges.findEmailChallenge(challengeId);
        if (!challenge) return err(domainError("not_found", "That code request wasn't found. Ask for a new one."));
        const now = d.clock.now();
        const { challenge: next, result } = attempt(challenge, d.secrets.hashCode(code.trim(), challenge.id), now);
        await scope.challenges.saveEmailChallenge(next);
        if (!result.ok) return result;

        let account = await scope.accounts.findByEmail(result.value);
        if (!account) {
          account = { id: d.newId(), email: result.value, wallet: null, createdAt: now };
          await scope.accounts.save(account);
        }
        if (account.suspendedAt) return suspended();
        return ok(await startSession(scope, account));
      });
    },

    /**
     * Signs in someone whose address a provider that runs it (Google, for Gmail and Workspace)
     * has just vouched for, the same way a code sent to it would; creates the account on first use.
     */
    async signInWithVerifiedEmail(rawEmail: string): Promise<Result<SignedIn, DomainError<"invalid_email" | "suspended">>> {
      const email = parseEmail(rawEmail);
      if (!email.ok) return email;
      return d.uow.run(async (scope) => {
        let account = await scope.accounts.findByEmail(email.value);
        if (!account) {
          account = { id: d.newId(), email: email.value, wallet: null, createdAt: d.clock.now() };
          await scope.accounts.save(account);
        }
        if (account.suspendedAt) return suspended();
        return ok(await startSession(scope, account));
      });
    },

    /** The message a wallet must sign to sign in. */
    async startWalletSignIn(p: { address: string; domain: string; uri: string; chainId: number; appName: string }): Promise<Result<{ nonce: string; message: string }, WalletError>> {
      const address = parseAddress(p.address);
      if (!address.ok) return address;
      const challenge = issueWalletChallenge({ ...p, address: address.value, nonce: d.secrets.newNonce(), issuedAt: d.clock.now() });
      await d.challenges.saveWalletChallenge(challenge);
      return ok({ nonce: challenge.nonce, message: challenge.message });
    },

    /** Verifies the signature over the issued message; signs in, creating the account on first use. */
    async completeWalletSignIn(nonce: string, signature: string): Promise<Result<SignedIn, WalletError | DomainError<"not_found" | "suspended">>> {
      const challenge = await d.challenges.findWalletChallenge(nonce);
      if (!challenge) return err(domainError("not_found", "That sign-in request wasn't found. Try again."));
      const signer = await d.verifier.recoverSigner(challenge.message, signature);
      if (!signer) return err(domainError("bad_signature", "The wallet's signature couldn't be read."));
      const consumed = consumeWalletChallenge(challenge, signer, d.clock.now());
      if (!consumed.ok) return consumed;

      return d.uow.run(async (scope) => {
        await scope.challenges.saveWalletChallenge(consumed.value);
        let account = await scope.accounts.findByWallet(signer);
        if (!account) {
          account = { id: d.newId(), email: null, wallet: signer, createdAt: d.clock.now() };
          await scope.accounts.save(account);
        }
        if (account.suspendedAt) return suspended();
        return ok(await startSession(scope, account));
      });
    },

    /** The account behind a session token, extending the session when due; null when signed out. */
    async currentAccount(token: string | undefined): Promise<{ account: AccountView; renewedUntil: Date | null } | null> {
      if (!token) return null;
      const session = await d.sessions.findByTokenHash(d.secrets.hashToken(token));
      const now = d.clock.now();
      if (!session || !isLive(session, now)) return null;
      const account = await d.accounts.findById(session.accountId);
      if (!account || account.suspendedAt) return null;
      const renewed = refreshed(session, now);
      if (renewed) await d.sessions.save(renewed);
      return { account: toAccountView(account), renewedUntil: renewed?.expiresAt ?? null };
    },

    /** An admin suspends an account (signing it out everywhere), or lifts the suspension. */
    async setSuspended(accountId: string, reason: string | null): Promise<Result<true, DomainError<"not_found" | "invalid_reason">>> {
      const account = await d.accounts.findById(accountId);
      if (!account) return err(domainError("not_found", "No such account."));
      if (reason !== null && (reason.trim().length < 5 || reason.length > 500)) return err(domainError("invalid_reason", "Say why in a sentence."));
      await d.accounts.setSuspension(accountId, reason === null ? null : d.clock.now(), reason === null ? null : reason.trim());
      if (reason !== null) await d.sessions.deleteForAccount(accountId);
      return ok(true);
    },

    /** The owner closes their account: its sign-in details go, and every device is signed out. */
    async close(accountId: string) {
      await d.accounts.close(accountId, d.clock.now());
      await d.sessions.deleteForAccount(accountId);
    },

    async signOut(token: string | undefined) {
      if (!token) return;
      const session = await d.sessions.findByTokenHash(d.secrets.hashToken(token));
      if (session) await d.sessions.delete(session.id);
    },
  };
}

export type Identity = ReturnType<typeof makeIdentity>;
