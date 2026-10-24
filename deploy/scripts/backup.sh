#!/usr/bin/env bash
# Nightly (cron): a compressed pg_dump streamed to Cloudflare R2; dumps older than 14 days
# are deleted. rclone reads its R2 settings from RCLONE_CONFIG_R2_* in .env.
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a

stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
target="r2:${BACKUP_BUCKET}/postgres/lychee-${stamp}.dump"
docker compose -f deploy/compose.yaml --env-file .env exec -T db pg_dump -U lychee -d lychee --format=custom --compress=9 | rclone rcat "$target"
rclone delete --min-age 14d "r2:${BACKUP_BUCKET}/postgres"
echo "$(date -u +%FT%TZ) backed up to $target"
