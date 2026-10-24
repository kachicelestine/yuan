#!/usr/bin/env bash
# Restores a backup over the live database. Destructive: stop traffic first.
#   deploy/scripts/restore.sh                       # lists backups
#   deploy/scripts/restore.sh lychee-…dump --yes    # restores that one
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
compose() { docker compose -f deploy/compose.yaml --env-file .env "$@"; }

if [ $# -eq 0 ]; then
  rclone lsl "r2:${BACKUP_BUCKET}/postgres" | sort -k2,3 | tail -20
  exit 0
fi
if [ "${2:-}" != "--yes" ]; then
  echo "This replaces the live database with $1. Re-run with --yes to continue." >&2
  exit 1
fi

compose stop app
rclone cat "r2:${BACKUP_BUCKET}/postgres/$1" | compose exec -T db pg_restore -U lychee -d lychee --clean --if-exists --no-owner
compose run --rm migrate
compose start app
echo "✓ restored $1"
