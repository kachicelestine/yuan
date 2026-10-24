/** Randomness and hashing, kept behind a port so the domain stays plain TypeScript. */
export interface Secrets {
  /** An unguessable session token for the browser (256 bits). */
  newToken(): string;
  /** A 6-digit sign-in code, uniformly random. */
  newCode(): string;
  /** A random nonce for wallet sign-in messages. */
  newNonce(): string;
  /** Keyed hash for codes (a 6-digit code alone is too easy to brute-force from a leaked hash). */
  hashCode(code: string, challengeId: string): string;
  /** Hash of a session token, as stored. */
  hashToken(token: string): string;
}

export interface Mailer {
  sendSignInCode(to: string, code: string): Promise<void>;
}

/** Recovers who signed a message (EIP-191 personal_sign). */
export interface SignatureVerifier {
  recoverSigner(message: string, signature: string): Promise<string | null>;
}

export type UnitOfWork<Scope> = { run<T>(work: (scope: Scope) => Promise<T>): Promise<T> };
