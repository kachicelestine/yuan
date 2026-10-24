import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

export const WALLET_CHALLENGE_TTL_MS = 5 * 60_000;

/** A sign-in request for a wallet: the exact message the wallet must sign, issued once. */
export type WalletChallenge = Readonly<{
  nonce: string;
  address: string;
  message: string;
  expiresAt: Date;
  consumedAt: Date | null;
}>;

export type WalletError = DomainError<"invalid_address" | "challenge_expired" | "challenge_used" | "bad_signature">;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function parseAddress(value: string): Result<string, WalletError> {
  return ADDRESS.test(value) ? ok(value) : err(domainError("invalid_address", "That isn't an Ethereum address."));
}

/**
 * Sign-In with Ethereum (EIP-4361). The wallet shows this text to the buyer, so it says
 * plainly who is asking and what for; the nonce and expiry stop it being replayed.
 */
export function signInMessage(p: { domain: string; uri: string; address: string; chainId: number; nonce: string; issuedAt: Date; appName: string }) {
  const expires = new Date(p.issuedAt.getTime() + WALLET_CHALLENGE_TTL_MS);
  return [
    `${p.domain} wants you to sign in with your Ethereum account:`,
    p.address,
    "",
    `Sign in to ${p.appName}. This doesn't move any funds or cost a fee.`,
    "",
    `URI: ${p.uri}`,
    "Version: 1",
    `Chain ID: ${p.chainId}`,
    `Nonce: ${p.nonce}`,
    `Issued At: ${p.issuedAt.toISOString()}`,
    `Expiration Time: ${expires.toISOString()}`,
  ].join("\n");
}

export function issueWalletChallenge(p: Parameters<typeof signInMessage>[0]): WalletChallenge {
  return { nonce: p.nonce, address: p.address, message: signInMessage(p), expiresAt: new Date(p.issuedAt.getTime() + WALLET_CHALLENGE_TTL_MS), consumedAt: null };
}

/** Spends a challenge once the signature is known to match its address. */
export function consumeWalletChallenge(c: WalletChallenge, signer: string, now: Date): Result<WalletChallenge, WalletError> {
  if (c.consumedAt) return err(domainError("challenge_used", "That sign-in request was already used."));
  if (now > c.expiresAt) return err(domainError("challenge_expired", "That sign-in request expired. Try again."));
  if (signer.toLowerCase() !== c.address.toLowerCase()) return err(domainError("bad_signature", "The signature doesn't match that wallet."));
  return ok({ ...c, consumedAt: now });
}
