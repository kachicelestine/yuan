#!/usr/bin/env bash
# Builds and starts a commit on this server, then checks it's healthy. Safe to re-run.
#   deploy/scripts/deploy.sh               # latest origin/main
#   deploy/scripts/deploy.sh 1a2b3c4d      # a specific commit (rollback)
set -euo pipefail
cd "$(dirname "$0")/../.."

ref="${1:-origin/main}"
git fetch --quiet origin
git checkout --quiet --detach "$ref"
export DEPLOYMENT_ID="$(git rev-parse --short=12 HEAD)"
compose() { docker compose -f deploy/compose.yaml --env-file .env "$@"; }

echo "→ building $DEPLOYMENT_ID"
compose build app
compose up -d db
echo "→ migrating"
compose run --rm migrate
echo "→ starting"
compose up -d --remove-orphans app tunnel

echo "→ waiting for /api/health"
probe="fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
for _ in $(seq 1 60); do
  if compose exec -T app node -e "$probe" 2>/dev/null; then healthy=1; break; fi
  sleep 2
done
if [ -z "${healthy:-}" ]; then
  echo "✗ $DEPLOYMENT_ID is not healthy; recent logs:" >&2
  compose logs --tail 80 app >&2
  exit 1
fi

# Pages prerendered during the build read an empty build database. Mark cached data stale
# so the first visits refresh it from the real one.
compose exec -T app node -e "
  fetch('http://127.0.0.1:3000/api/internal/revalidate', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + process.env.INTERNAL_TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify({ tags: ['catalog', 'markets', 'content'] }),
  }).then(r => process.exit(r.ok ? 0 : 1))"

docker image prune -f --filter "until=168h" >/dev/null
echo "✓ deployed $DEPLOYMENT_ID"
