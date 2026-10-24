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
2. **R2:** create a bucket `lychee-backups`. Then R2 → *Manage API tokens* → create a token with **Object Read & Write** on that bucket. Note the access key ID, secret and account ID.
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
