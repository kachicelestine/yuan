// Public surface of the identity context.
export { makeIdentity, toAccountView, type AccountView, type Identity, type IdentityDeps, type SignedIn } from "./application/sign-in";
export type { Mailer, Secrets, SignatureVerifier } from "./application/ports";
export { accountLabel, parseEmail, type Account, type Email } from "./domain/account";
export { CODE_TTL_MS, MAX_ATTEMPTS, SESSION_TTL_MS } from "./domain/sign-in";
export { signInMessage, WALLET_CHALLENGE_TTL_MS } from "./domain/wallet";
