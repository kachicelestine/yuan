# Deploying Lychee (stage 0: one free server)

One Oracle Cloud Always Free ARM server runs the app, Postgres and background jobs in Docker. Cloudflare serves the site through a **Tunnel**: the server opens no web ports, and Cloudflare's edge handles TLS, caching, compression and attack filtering. Backups go to Cloudflare R2 nightly. Monthly cost: $0 plus a domain. Background: [docs/research/05](../docs/research/05-infrastructure-free-to-faang.md).

```
visitors ─▶ Cloudflare (DNS, CDN, WAF, R2) ◀── tunnel (outbound) ── cloudflared ─┐
                                                                                │
                Oracle A1 VM (2 OCPU, 12 GB): app (Next.js + jobs) ◀────────────┘
                                              Postgres 18 ─── nightly dump ──▶ R2
```

## One-time setup (about an hour)

### 1. Accounts you create

1. **Domain:** any registrar; point its nameservers to Cloudflare when Cloudflare asks.
2. **Cloudflare** (free plan): add the domain.
3. **Oracle Cloud** (Always Free): pick the **home region** closest to your buyers that has Ampere A1 capacity. It can't be changed later; Johannesburg (`af-johannesburg-1`) is the nearest to West Africa. Upgrading the account to pay-as-you-go keeps Always Free resources free and makes "out of capacity" errors rarer.

### 2. Cloudflare

1. **Tunnel:** Zero Trust → Networks → Tunnels → *Create a tunnel* → Cloudflared. Name it `lychee` and copy the **token** (the long string after `--token`). Add a public hostname: your domain (and `www`) → service `http://app:3000`.
2. **R2:** create three buckets: `lychee-backups`, `lychee-media` and `lychee-private` (seller identity documents; never give it a public domain). Then R2 → *Manage API tokens* → create a token with **Object Read & Write** on all three. Note the access key ID, secret and account ID (they go in `.env` twice: `R2_*` for videos, `RCLONE_CONFIG_R2_*` for backups).
   - On `lychee-media` → Settings → **Custom domain**: `media.<your domain>` (this is `MEDIA_PUBLIC_URL`; R2 serves it with no egress fees).
   - On `lychee-media` → Settings → **CORS policy**, so browsers can upload straight to the bucket:
     ```json
     [{ "AllowedOrigins": ["https://<your domain>"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
     ```
   - On `lychee-private` → the same CORS policy (sellers upload documents straight to it), and **no** custom domain or public access.
3. **Speed and security:** SSL/TLS → Always Use HTTPS **on**; Speed → Brotli **on**; Security → Bot Fight Mode **on**.

### 3. The server

1. Oracle console → Compute → *Create instance*:
   - **Image:** Ubuntu 24.04 (aarch64)
   - **Shape:** `VM.Standard.A1.Flex` with **2 OCPU, 12 GB**
   - **Boot volume:** 150 GB
   - **SSH:** your public key
   - **Advanced options → Initialization script:** paste [`oracle/cloud-init.yaml`](oracle/cloud-init.yaml)

   The default network only allows SSH (22), which is all we need.
2. SSH in (`ssh ubuntu@<public-ip>`) and clone the repository:
   ```bash
   cd /opt/lychee
   ssh-keygen -t ed25519 -f ~/.ssh/github -N ""   # add ~/.ssh/github.pub as a read-only deploy key on GitHub
   GIT_SSH_COMMAND="ssh -i ~/.ssh/github" git clone git@github.com:<you>/<repo>.git .
   git config core.sshCommand "ssh -i ~/.ssh/github"
   ```
3. Create the settings file and fill it in (generate each secret with `openssl rand -base64 32`):
   ```bash
   cp deploy/env.production.example .env && chmod 600 .env && nano .env
   ```
4. Deploy:
   ```bash
   deploy/scripts/deploy.sh
   ```
   The first build takes about 5–10 minutes on 2 OCPUs. When it prints `✓ deployed <commit>`, open your domain.
5. Seed the catalog once (countries are required; the sample catalog is optional):
   ```bash
   docker compose -f deploy/compose.yaml --env-file .env run --rm migrate node ops/seed.mjs
   ```

### 4. Automatic deploys (optional)

GitHub → Settings → Secrets: `DEPLOY_HOST`, `DEPLOY_USER` (`ubuntu`), `DEPLOY_SSH_KEY` (a key allowed on the server), and `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan <ip>`). Then:
- run the **Deploy** workflow by hand, or
- set the repository variable `AUTO_DEPLOY=true` to deploy every green push to `main`.

### 5. Live video (optional)

Live rooms work without this (chat, products and auctions, over the cover photo). For video, run the media server (MediaMTX) next to the app:

1. **Tunnel hostnames** (Zero Trust → your tunnel → *Public hostnames*): `whip.<your domain>` → `http://media:8889` (sellers publish here) and `live.<your domain>` → `http://media:8888` (buyers watch here).
2. **Open UDP 8189** for the video itself, which can't go through the tunnel: Oracle console → your VCN → *Security Lists* → add an ingress rule, source `0.0.0.0/0`, **UDP**, destination port `8189`. Docker publishes the port past the server's own firewall.
3. In `.env`: `LIVE_INGEST_URL=https://whip.<your domain>`, `LIVE_PLAYBACK_URL=https://live.<your domain>`, `PUBLIC_IP=<the server's public IP>`, and `COMPOSE_PROFILES=live`.
4. `deploy/scripts/deploy.sh`. Sellers go live from `/sell/live` with their browser's camera, or from OBS (Settings → Stream → *WHIP*, with the server URL the studio shows).

MediaMTX checks every publish and every viewer with the app (`/api/live/auth`): only the show's stream key can publish, and only while the show is live can anyone watch.

### 6. Ask, the shopping assistant (optional)

Ask, photo search and translation run on Gemini. Create an API key at aistudio.google.com on a Google Cloud project with billing on (the free tier may not serve people in the EEA, Switzerland or the UK, and Google's reviewers may read what's sent; set a budget alert in the Cloud console), put it in `.env` as `GEMINI_API_KEY=…`, and run `deploy/scripts/deploy.sh`. Without a key, Ask says it isn't switched on. Only signed-in shoppers can ask, 30 questions an hour each. `ASK_MODEL` picks the model (default `gemini-3.8-flash`; `gemini-4-argon` reasons best and costs most, `gemini-3.5-flash-lite` costs least).

## Day to day

| Task | Command (on the server, in `/opt/lychee`) |
|---|---|
| Deploy latest `main` | `deploy/scripts/deploy.sh` |
| Roll back | `deploy/scripts/deploy.sh <older-commit>` |
| Logs | `docker compose -f deploy/compose.yaml --env-file .env logs -f app` |
| Health | `curl -s localhost:3000/api/health` (inside: `docker compose … exec app …`) or `https://<domain>/api/health` |
| Database shell | `docker compose -f deploy/compose.yaml --env-file .env exec db psql -U lychee` |
| Backup now | `deploy/scripts/backup.sh` (also runs nightly at 02:15 UTC) |
| List / restore backups | `deploy/scripts/restore.sh` / `deploy/scripts/restore.sh <file> --yes` |

**Restore drill: monthly.** A backup you haven't restored isn't a backup. Restore the newest dump into a scratch database and check row counts.

**Monitoring:** point a free uptime checker (Better Stack, UptimeRobot) at `https://<domain>/api/health`. It returns 503 when the database is unreachable, and its body shows background-job status and the outbox backlog.

## Limits of this stage, and what's next

- **One server:** a host failure means downtime until it's replaced and restored. That's acceptable before revenue. Stage 1 adds a second app server and managed Postgres with point-in-time recovery ([research 05](../docs/research/05-infrastructure-free-to-faang.md#stage-1-first-revenue-50300month)).
- **Deploys restart the app** for a few seconds. Two instances behind the tunnel (stage 1) remove that gap. `deploymentId` already makes open pages reload cleanly across versions.
- **Backups are nightly** (up to 24 h of data at risk). Stage 1 adds continuous WAL archiving to R2.
- **Videos are encoded on the same server** (ffmpeg, one at a time, `ENCODE_THREADS` cores). A minute of phone video takes roughly a minute on 2 OCPUs. When uploads outgrow that, run the `worker` profile on a second free instance with `JOBS=off` on the app, or move encoding to a managed service behind the same `VideoEncoder` port.
- **Live video on one server:** MediaMTX repackages (never re-encodes) the seller's H.264, so a show costs little CPU, but every viewer's video leaves this server through the tunnel. That suits a first audience; Cloudflare's terms steer heavy video to its paid products, so as live grows, move playback to Cloudflare Stream (it takes WHIP in and serves HLS) or a CDN made for video, behind the same `LIVE_INGEST_URL`/`LIVE_PLAYBACK_URL`.
- **Moderation:** with `CONTENT_PREMODERATION=true`, new uploads wait in "review" until someone in `ADMIN_EMAILS` approves them at `/admin`, where seller applications and reports also queue.
