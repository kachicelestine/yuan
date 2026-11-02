# Running on Vercel

The app was designed for one always-on server (see [README.md](README.md)), and it also runs on Vercel with Neon Postgres. Three things are different there, and the code handles them:

- **Migrations** run during production deploys (`vercel.json` calls `pnpm build:vercel`).
- **Background jobs** have no process to live in, so something calls `/api/internal/jobs` on a schedule. Events also go out right after the request that made them.
- **Files** can't live on the server's disk, so uploads need Cloudflare R2.

A bad setting now stops the deploy with a message naming it. If the site is ever down, open `/api/health`: it answers with what's wrong.

## 1. Settings

Vercel → your project → Settings → Environment Variables, for Production. Generate each secret with `openssl rand -base64 32`. These are read when the app builds, so **redeploy after changing any of them**.

### Required

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_SEAL`, `NEXT_PUBLIC_BRAND_TAGLINE` | The brand shown everywhere |
| `NEXT_PUBLIC_SITE_URL` | The real address, e.g. `https://yuan-mu.vercel.app` |
| `DATABASE_URL` | Neon's pooled connection string |
| `AUTH_SECRET` | A generated secret (32+ characters) |
| `INTERNAL_TOKEN` | A different generated secret (32+ characters) |
| `ADMIN_EMAILS` | Who can open `/admin`, comma-separated |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sign-in codes and order emails; the sender's domain must be verified in Resend |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Optional. Browser alerts, from `pnpm exec web-push generate-vapid-keys`. Keep the pair once set: changing it stops alerts until people turn them on again |
| `AUTH_DEV_CODES` | `false` |

### Taking payments

| Name | Value |
| --- | --- |
| `PAYMENTS_MODE` | `onchain` |
| `PAYMENTS_BASE_ADDRESS`, `PAYMENTS_BASE_RPC_URL` | Treasury wallet and RPC for Base |
| `PAYMENTS_SOLANA_ADDRESS`, `PAYMENTS_SOLANA_RPC_URL` | Optional: Solana |
| `PAYMENTS_TRON_ADDRESS`, `PAYMENTS_TRON_API_KEY` | Optional: Tron |
| `PAYMENTS_BASE_CHAIN`, `PAYMENTS_SOLANA_CLUSTER`, `PAYMENTS_TRON_NETWORK` | `base`, `mainnet`, `mainnet` for real money. The defaults are test networks. |

### Uploads

`STORAGE=r2`, with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PRIVATE_BUCKET` and `MEDIA_PUBLIC_URL`. Create one public bucket and one private bucket, and on the public bucket add a CORS rule allowing `PUT` from your site. Without this, the site runs and uploads show "Uploads aren't set up on this server yet."

### Optional

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | Turns on Ask, photo search and translation. From aistudio.google.com, on a project with **billing on**: the free tier may not serve people in the EEA, Switzerland or the UK, and Google's reviewers may read what's sent |
| `ASK_MODEL` | The Gemini model behind them; leave it unset for `gemini-3.8-flash`. Delete any old `claude-…` value: the deploy stops on it |
| `NEXT_PUBLIC_LEGAL_NAME` | The company named in the Terms and Privacy Policy |
| `NEXT_PUBLIC_LEGAL_JURISDICTION` | Whose laws govern the Terms, e.g. `England and Wales` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Where Help sends people |
| `RESTRICTED_COUNTRIES` | Comma-separated country codes to refuse. Default: `BY,CU,IR,KP,RU,SY` |
| `CONTENT_PREMODERATION` | `false` publishes new posts without a moderator. Default on. |

Don't set `DEMO_DEPLOYMENT` on a public site. It allows on-screen sign-in codes and simulated payments, so anyone could sign in as anyone and mark orders as paid.

`JOBS` and `TRUST_PROXY` set themselves on Vercel.

## 2. Background jobs

These confirm payments, send emails and reminders, release escrow, and refresh exchange rates.

1. GitHub → the repository → Settings → Secrets and variables → Actions → the **Secrets** tab → **New repository secret** (not Variables, and not Environment secrets): add `SITE_URL` (no trailing slash) and `INTERNAL_TOKEN`, the same value as on Vercel. The **Background jobs** workflow then runs about every 5 minutes.
2. For every minute, which is better while taking payments, add a free job at [cron-job.org](https://cron-job.org): `GET https://your-site/api/internal/jobs` with the header `Authorization: Bearer <INTERNAL_TOKEN>`. Both can run together.

Vercel's own cron can't do this on the Hobby plan, which allows one run a day.

## 3. Deploy and check

1. Push to `main`, or redeploy from Vercel.
2. Open `/api/health`. It should say `"status":"ok"` and show `"database":{"ok":true}`.
3. Sign in with an `ADMIN_EMAILS` address, and open `/admin`.

## Sample data

`pnpm db:seed` loads sample shops, listings, videos and reviews. They're made up, so hide them before real customers arrive:

```bash
pnpm db:samples        # how many are visible
pnpm db:samples hide   # take them off the site
pnpm db:samples show   # bring them back
```

These run against the `DATABASE_URL` in your local `.env`. Nothing is deleted.

## Live video

Chat, products and bids work without extra setup, over a direct database connection that's worked out from Neon's pooled address (set `DATABASE_LISTEN_URL` for other hosts). Video needs a media server somewhere that stays on, such as the `media` service in [compose.yaml](compose.yaml); then set `LIVE_INGEST_URL` and `LIVE_PLAYBACK_URL`.
