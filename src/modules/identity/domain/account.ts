import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

/** A buyer (or, later, a seller). Signs in with an email code or a wallet signature. */
export type Account = Readonly<{
  id: string;
  /** Lower-case, trimmed. */
  email: string | null;
  /** EVM address in checksum form, from wallet sign-in. */
  wallet: string | null;
  createdAt: Date;
  /** Set by an admin: the account can't sign in and its sessions end. */
  suspendedAt?: Date | null;
  suspendReason?: string | null;
}>;

export type Email = string & { readonly __brand: "Email" };

// Deliberately simple: one "@", something either side, a dot in the domain, no spaces.
// The real check is that a code sent to it arrives.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(value: string): Result<Email, DomainError<"invalid_email">> {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return err(domainError("invalid_email", "That doesn't look like an email address."));
  return ok(email as Email);
}

/** A short label for the account: the email, or the wallet shortened to 0x12…abcd. */
export const accountLabel = (a: Pick<Account, "email" | "wallet">) => a.email ?? (a.wallet ? `${a.wallet.slice(0, 6)}…${a.wallet.slice(-4)}` : "Account");
