#!/usr/bin/env bash
# Deploy a git ref (default: origin/main) to the UAT stack on this machine.
#
#   deploy/uat/deploy.sh                # deploy origin/main
#   deploy/uat/deploy.sh <commit|ref>   # deploy something else (e.g. to roll back)
#
# Builds from a clean export of the ref (never from a working copy), backs up the database first,
# waits until the hub answers, and prints what is running. See docs/guides/uat.md.
set -euo pipefail

REF="${1:-origin/main}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
STATE_DIR="${TOHE_UAT_STATE:-$HOME/.local/share/tohe-uat}"
ENV_FILE="${TOHE_UAT_ENV:-$HOME/.config/tohe-uat/uat.env}"
SRC="$STATE_DIR/src"

log() { printf '\033[1m[uat]\033[0m %s\n' "$*"; }

# Secrets live outside git. Created once with a random database password.
if [[ ! -f "$ENV_FILE" ]]; then
  mkdir -p "$(dirname "$ENV_FILE")"
  # Subshell: the restrictive umask must not leak into the source export below (the API image runs as a
  # non-root user and must be able to read its files).
  (
    umask 077
    {
      echo "TOHE_UAT_HOST=10.100.0.2"
      echo "TOHE_UAT_DB_PASSWORD=$(openssl rand -hex 24)"
    } >"$ENV_FILE"
  )
  log "created $ENV_FILE (keep it; the database password is in it)"
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

git -C "$REPO" fetch --quiet origin
SHA="$(git -C "$REPO" rev-parse --short=12 "$REF^{commit}")"
log "deploying $REF ($SHA)"

if docker compose -p tohe-uat ps --status running --services 2>/dev/null | grep -qx postgres; then
  "$HERE/backup.sh"
fi

rm -rf "$SRC"
mkdir -p "$SRC"
git -C "$REPO" archive "$SHA" | (umask 022 && tar -x -C "$SRC")

cd "$SRC"
export TOHE_VERSION="$SHA"
# --pull: base images (dotnet runtime, node, caddy) use moving tags; take their latest security patches every time.
docker compose -f compose.uat.yaml --env-file "$ENV_FILE" build --pull
docker compose -f compose.uat.yaml --env-file "$ENV_FILE" up -d --remove-orphans

HUB="http://${TOHE_UAT_HOST}:4820"
log "waiting for $HUB/api/health"
for _ in $(seq 1 60); do
  if curl -fsS "$HUB/api/health" >/dev/null 2>&1; then
    log "healthy — version $(curl -fsS "$HUB/api/config" | sed -E 's/.*"apiVersion":"([^"]*)".*/\1/')"
    log "hub  $HUB"
    log "docs http://${TOHE_UAT_HOST}:4810/docs/"
    exit 0
  fi
  sleep 2
done
log "the hub did not become healthy; recent API logs:"
docker compose -p tohe-uat logs --tail 40 api
exit 1
