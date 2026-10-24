import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { recoverMessageAddress } from "viem";
import type { Mailer, Secrets, SignatureVerifier } from "../application/ports";

/** Node's CSPRNG and HMAC. `secret` keys the code hashes, so a leaked table can't be brute-forced offline. */
export class NodeSecrets implements Secrets {
  constructor(private readonly secret: string) {}

  newToken() {
    return randomBytes(32).toString("base64url");
  }

  newCode() {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  }

  newNonce() {
    // EIP-4361 nonces are alphanumeric, at least 8 characters.
    return randomBytes(12).toString("hex");
  }

  hashCode(code: string, challengeId: string) {
    return createHmac("sha256", this.secret).update(`${challengeId}:${code}`).digest("hex");
  }

  hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}

/** Sends sign-in codes through Resend's HTTP API (resend.com). */
export class ResendMailer implements Mailer {
  constructor(private readonly opts: { apiKey: string; from: string; appName: string; fetch?: typeof fetch }) {}

  async sendSignInCode(to: string, code: string) {
    const res = await (this.opts.fetch ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.opts.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: this.opts.from,
        to: [to],
        subject: `${code} is your ${this.opts.appName} code`,
        text: `Your ${this.opts.appName} sign-in code is ${code}.\n\nIt works once, for 10 minutes. If you didn't ask for it, ignore this email.`,
      }),
    });
    if (!res.ok) throw new Error(`Email failed: HTTP ${res.status}`);
  }
}

/** Development: prints codes to the server console instead of emailing them. */
export class ConsoleMailer implements Mailer {
  async sendSignInCode(to: string, code: string) {
    console.info(`[mail] sign-in code for ${to}: ${code}`);
  }
}

/** EIP-191 signature recovery for externally owned accounts (most wallets). */
export class ViemVerifier implements SignatureVerifier {
  async recoverSigner(message: string, signature: string) {
    if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return null;
    try {
      return await recoverMessageAddress({ message, signature: signature as `0x${string}` });
    } catch {
      return null;
    }
  }
}
