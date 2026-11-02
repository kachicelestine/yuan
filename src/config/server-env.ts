import { z } from "zod";

// Server-only settings. Import this from server code and scripts only; it reads
// secrets that must never reach the browser.

/** Treats an empty string (as left by `.env.example`) as "not set". */
const optional = <T extends z.ZodType>(type: T) => z.preprocess((v) => (v === "" ? undefined : v), type.optional());

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x… EVM address");
const solanaAddress = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "must be a base58 Solana address");
const tronAddress = z.string().regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, "must be a T… Tron address");

/** Vercel sets this on its builds and functions. */
const onVercel = Boolean(process.env.VERCEL);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: optional(z.url().refine((u) => /^postgres(ql)?:\/\//.test(u), "must start with postgres://")),
    /** A direct (unpooled) connection for live updates: LISTEN doesn't survive a transaction pooler. Derived for Neon. */
    DATABASE_LISTEN_URL: optional(z.url().refine((u) => u.startsWith("postgres"), "must start with postgres://")),
    PAYMENTS_MODE: z.enum(["simulated", "onchain"]).default("simulated"),
    PAYMENTS_BASE_ADDRESS: optional(evmAddress),
    PAYMENTS_SOLANA_ADDRESS: optional(solanaAddress),
    PAYMENTS_TRON_ADDRESS: optional(tronAddress),
    PAYMENTS_BASE_RPC_URL: optional(z.url()),
    /** Which Base network the RPC and USDC contract are on. */
    PAYMENTS_BASE_CHAIN: z.enum(["base", "base-sepolia"]).default("base-sepolia"),
    /** A Solana JSON-RPC endpoint (Helius, QuickNode, Triton…; the public one is rate-limited). */
    PAYMENTS_SOLANA_RPC_URL: optional(z.url()),
    /** Which Solana cluster the RPC and USDC mint are on. */
    PAYMENTS_SOLANA_CLUSTER: z.enum(["mainnet", "devnet"]).default("devnet"),
    /** Which Tron network the treasury and USDT contract are on. */
    PAYMENTS_TRON_NETWORK: z.enum(["mainnet", "nile"]).default("nile"),
    /** TronGrid (or a compatible API). Defaults to TronGrid for PAYMENTS_TRON_NETWORK. */
    PAYMENTS_TRON_API_URL: optional(z.url()),
    /** TronGrid API key: without one, requests are heavily rate-limited. */
    PAYMENTS_TRON_API_KEY: optional(z.string().min(8)),
    /** Keys the sign-in code hashes. 32+ random characters; changing it voids codes in flight. */
    AUTH_SECRET: optional(z.string().min(32, "must be at least 32 characters")),
    /** Show sign-in codes on screen instead of emailing them. Local development only. */
    AUTH_DEV_CODES: z.stringbool().default(false),
    /** Gemini API key (aistudio.google.com) for Ask, photo search and translation; without one, they're switched off. */
    GEMINI_API_KEY: optional(z.string().min(30, "must be a Gemini API key")),
    /** The Gemini model behind Ask, photo search and translation. */
    ASK_MODEL: z.string().startsWith("gemini-", "must be a Gemini model, e.g. gemini-3.8-flash").default("gemini-3.8-flash"),
    /** Resend (resend.com) API key and sender, for sign-in emails. */
    RESEND_API_KEY: optional(z.string().startsWith("re_", "must be a Resend key (re_…)")),
    EMAIL_FROM: optional(z.string().min(3)),
    /** "Continue with Google": an OAuth client (Google Cloud console, Web application). Without the pair, the button hides. */
    GOOGLE_CLIENT_ID: optional(z.string().endsWith(".apps.googleusercontent.com", "must be a Google OAuth client ID (….apps.googleusercontent.com)")),
    GOOGLE_CLIENT_SECRET: optional(z.string().min(10)),
    /** Browser alerts: `pnpm exec web-push generate-vapid-keys` makes the pair. Without it, alerts stay off. */
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional(z.string().min(20)),
    VAPID_PRIVATE_KEY: optional(z.string().min(20)),
    /**
     * inline: the web server also runs background jobs (outbox delivery, invoice sweeps,
     * rate refresh); right for a single server. off: run them in `pnpm worker`, or on
     * serverless hosts by calling GET /api/internal/jobs on a schedule.
     */
    JOBS: z.enum(["inline", "off"]).default(onVercel ? "off" : "inline"),
    /** Authorises internal calls (cache revalidation from jobs and deploys). 32+ random characters. */
    INTERNAL_TOKEN: optional(z.string().min(32, "must be at least 32 characters")),
    /** Where jobs reach this app for internal calls. Defaults to http://127.0.0.1:$PORT. */
    INTERNAL_URL: optional(z.url()),
    /** Which proxy's client-IP header to believe: Cloudflare's, a reverse proxy's X-Forwarded-For, or none. */
    TRUST_PROXY: z.enum(["cloudflare", "proxy", "none"]).default(onVercel ? "proxy" : "none"),
    /** json for log shippers in production; pretty for people. */
    LOG_FORMAT: optional(z.enum(["json", "pretty"])),
    /** A public demo or staging site: allows simulated payments and on-screen sign-in codes in production. */
    DEMO_DEPLOYMENT: z.stringbool().default(false),
    /** Where uploads and encoded videos live: this machine's disk, or a Cloudflare R2 bucket. */
    STORAGE: z.enum(["local", "r2"]).default("local"),
    /** Folder for STORAGE=local. */
    MEDIA_DIR: z.string().min(1).default(".data/media"),
    /** Folder for identity and business documents with STORAGE=local. Never served publicly. */
    PRIVATE_DIR: z.string().min(1).default(".data/private"),
    /** A second R2 bucket with no public domain, for identity and business documents. */
    R2_PRIVATE_BUCKET: optional(z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "must be an R2 bucket name")),
    R2_ACCOUNT_ID: optional(z.string().regex(/^[a-f0-9]{32}$/, "must be the 32-character account id")),
    R2_ACCESS_KEY_ID: optional(z.string().min(16)),
    R2_SECRET_ACCESS_KEY: optional(z.string().min(32)),
    R2_BUCKET: optional(z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "must be an R2 bucket name")),
    /** The bucket's public domain, e.g. https://media.example.com. */
    MEDIA_PUBLIC_URL: optional(z.url()),
    /** ffmpeg encodes uploads; copy serves them as uploaded (machines without ffmpeg). Default: ffmpeg when installed. */
    VIDEO_ENCODER: optional(z.enum(["ffmpeg", "copy"])),
    /** CPU threads per encode; keep low on a server that also serves pages. */
    ENCODE_THREADS: z.coerce.number().int().min(1).max(16).default(1),
    /** Hold new uploads for a moderator before they're public. Default: on in production. */
    CONTENT_PREMODERATION: optional(z.stringbool()),
    /** The media server's WHIP base (hosts broadcast here), e.g. https://live.example.com. Unset: shows run without video. */
    LIVE_INGEST_URL: optional(z.url()),
    /** Where viewers fetch HLS, e.g. https://live.example.com (Cloudflare caches it). Defaults to LIVE_INGEST_URL. */
    LIVE_PLAYBACK_URL: optional(z.url()),
    /** Comma-separated ISO country codes we won't ship to or take shops from. Unset: the list in markets/domain/restricted.ts. */
    RESTRICTED_COUNTRIES: z.string().optional(),
    /** Share of each sale the platform keeps when Protect releases it, e.g. 0.06 for 6%. */
    PLATFORM_COMMISSION: z.coerce.number().min(0).max(0.5).default(0.06),
    /** Comma-separated emails of people who can open the admin console (they sign in with that email). */
    ADMIN_EMAILS: z
      .string()
      .default("")
      .transform((v) => v.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),
  })
  .superRefine((env, ctx) => {
    if (!env.GOOGLE_CLIENT_ID !== !env.GOOGLE_CLIENT_SECRET) ctx.addIssue({ code: "custom", path: ["GOOGLE_CLIENT_SECRET"], message: "set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither" });
    if (!env.VAPID_PRIVATE_KEY !== !env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) ctx.addIssue({ code: "custom", path: ["VAPID_PRIVATE_KEY"], message: "set both VAPID_PRIVATE_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY, or neither" });
    // Docker images build without secrets, so those builds can't check them. Vercel builds
    // see the same settings as the running site: a bad one should stop the deploy, not
    // fail every request after it.
    const checkable = process.env.NEXT_PHASE !== "phase-production-build" || onVercel;
    // A production server with a real database is a real deployment.
    if (env.NODE_ENV === "production" && env.DATABASE_URL && checkable) {
      if (!env.AUTH_SECRET) ctx.addIssue({ code: "custom", path: ["AUTH_SECRET"], message: "required in production" });
      if (!env.INTERNAL_TOKEN) ctx.addIssue({ code: "custom", path: ["INTERNAL_TOKEN"], message: "required in production" });
      // Either would let anyone mark an order paid or sign in as anyone.
      if (!env.DEMO_DEPLOYMENT && env.PAYMENTS_MODE === "simulated") ctx.addIssue({ code: "custom", path: ["PAYMENTS_MODE"], message: "simulated payments in production need DEMO_DEPLOYMENT=true" });
      if (!env.DEMO_DEPLOYMENT && env.AUTH_DEV_CODES) ctx.addIssue({ code: "custom", path: ["AUTH_DEV_CODES"], message: "on-screen sign-in codes in production need DEMO_DEPLOYMENT=true" });
    }
    // Real money means a real deployment: no shortcuts in how people sign in.
    if (env.PAYMENTS_MODE === "onchain") {
      if (!env.AUTH_SECRET) ctx.addIssue({ code: "custom", path: ["AUTH_SECRET"], message: "required when taking real payments" });
      if (env.AUTH_DEV_CODES) ctx.addIssue({ code: "custom", path: ["AUTH_DEV_CODES"], message: "must be off when taking real payments" });
      if (!env.RESEND_API_KEY || !env.EMAIL_FROM) ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "RESEND_API_KEY and EMAIL_FROM are required when taking real payments" });
    }
    if (env.STORAGE === "r2") {
      for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PRIVATE_BUCKET", "MEDIA_PUBLIC_URL"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "required when STORAGE=r2" });
      }
      // The public bucket is served to anyone at MEDIA_PUBLIC_URL; identity documents and chat photos must never be in it.
      if (env.R2_BUCKET && env.R2_BUCKET === env.R2_PRIVATE_BUCKET) ctx.addIssue({ code: "custom", path: ["R2_PRIVATE_BUCKET"], message: "must be a different bucket from R2_BUCKET: it holds identity documents and chat photos, and R2_BUCKET is public" });
    }
    // Each rail is offered when its treasury address is set.
    if (env.PAYMENTS_MODE === "onchain" && !env.PAYMENTS_BASE_ADDRESS && !env.PAYMENTS_SOLANA_ADDRESS && !env.PAYMENTS_TRON_ADDRESS) {
      ctx.addIssue({ code: "custom", path: ["PAYMENTS_BASE_ADDRESS"], message: "onchain payments need at least one treasury address (Base, Solana or Tron)" });
    }
    if (env.PAYMENTS_MODE === "onchain" && env.PAYMENTS_BASE_ADDRESS && !env.PAYMENTS_BASE_RPC_URL) {
      ctx.addIssue({ code: "custom", path: ["PAYMENTS_BASE_RPC_URL"], message: "required when PAYMENTS_BASE_ADDRESS is set" });
    }
    if (env.PAYMENTS_MODE === "onchain" && env.PAYMENTS_SOLANA_ADDRESS && !env.PAYMENTS_SOLANA_RPC_URL) {
      ctx.addIssue({ code: "custom", path: ["PAYMENTS_SOLANA_RPC_URL"], message: "required when PAYMENTS_SOLANA_ADDRESS is set" });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid server environment. See .env.example.\n${z.prettifyError(parsed.error)}`);
}

export const serverEnv = parsed.data;
