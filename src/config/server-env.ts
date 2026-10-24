import { z } from "zod";

// Server-only settings. Import this from server code and scripts only; it reads
// secrets that must never reach the browser.

/** Treats an empty string (as left by `.env.example`) as "not set". */
const optional = <T extends z.ZodType>(type: T) => z.preprocess((v) => (v === "" ? undefined : v), type.optional());

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x… EVM address");
const solanaAddress = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "must be a base58 Solana address");
const tronAddress = z.string().regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, "must be a T… Tron address");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: optional(z.url().refine((u) => /^postgres(ql)?:\/\//.test(u), "must start with postgres://")),
    PAYMENTS_MODE: z.enum(["simulated", "onchain"]).default("simulated"),
    PAYMENTS_BASE_ADDRESS: optional(evmAddress),
    PAYMENTS_SOLANA_ADDRESS: optional(solanaAddress),
    PAYMENTS_TRON_ADDRESS: optional(tronAddress),
    PAYMENTS_BASE_RPC_URL: optional(z.url()),
    /** Which Base network the RPC and USDC contract are on. */
    PAYMENTS_BASE_CHAIN: z.enum(["base", "base-sepolia"]).default("base-sepolia"),
    /** Keys the sign-in code hashes. 32+ random characters; changing it voids codes in flight. */
    AUTH_SECRET: optional(z.string().min(32, "must be at least 32 characters")),
    /** Show sign-in codes on screen instead of emailing them. Local development only. */
    AUTH_DEV_CODES: z.stringbool().default(false),
    /** Resend (resend.com) API key and sender, for sign-in emails. */
    RESEND_API_KEY: optional(z.string().startsWith("re_", "must be a Resend key (re_…)")),
    EMAIL_FROM: optional(z.string().min(3)),
  })
  .superRefine((env, ctx) => {
    // Real money means a real deployment: no shortcuts in how people sign in.
    if (env.PAYMENTS_MODE === "onchain") {
      if (!env.AUTH_SECRET) ctx.addIssue({ code: "custom", path: ["AUTH_SECRET"], message: "required when taking real payments" });
      if (env.AUTH_DEV_CODES) ctx.addIssue({ code: "custom", path: ["AUTH_DEV_CODES"], message: "must be off when taking real payments" });
      if (!env.RESEND_API_KEY || !env.EMAIL_FROM) ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "RESEND_API_KEY and EMAIL_FROM are required when taking real payments" });
    }
    // Base is the only rail with an on-chain verifier so far.
    if (env.PAYMENTS_MODE === "onchain" && !env.PAYMENTS_BASE_ADDRESS) {
      ctx.addIssue({ code: "custom", path: ["PAYMENTS_BASE_ADDRESS"], message: "onchain payments need a Base treasury address" });
    }
    if (env.PAYMENTS_MODE === "onchain" && env.PAYMENTS_BASE_ADDRESS && !env.PAYMENTS_BASE_RPC_URL) {
      ctx.addIssue({ code: "custom", path: ["PAYMENTS_BASE_RPC_URL"], message: "required when PAYMENTS_BASE_ADDRESS is set" });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid server environment. See .env.example.\n${z.prettifyError(parsed.error)}`);
}

export const serverEnv = parsed.data;
