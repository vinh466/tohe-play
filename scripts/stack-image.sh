#!/usr/bin/env bash
# Mode C: run the images CI published for a commit on this machine, to reproduce a problem seen on UAT or production.
#
#   pnpm stack:image <tag|commit>   # a uat-/prod- tag, a branch, a commit: whatever git can resolve to a commit
#   pnpm stack:image --down         # stop it and remove its database (Mode C data is throwaway)
#
# The images are the ones UAT and production run (ADR 0041), pulled from ghcr.io, never built here. They run in their own
# compose project, tohe-image, on the development ports (47xx) — so it refuses to start while the development stack
# (project `tohe`) is up, and it never touches UAT (`tohe-uat`). See docs/guides/local-development.md.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
PROJECT="${TOHE_IMAGE_PROJECT:-tohe-image}"
HUB="http://localhost:4720"

log() { printf '\033[1m[stack:image]\033[0m %s\n' "$*"; }
die() { log "$*" >&2; exit 1; }

# Never the family's environment, nor the development stack: both hold data this script would replace or remove.
case "$PROJECT" in
  tohe-uat) die "refusing to use the compose project tohe-uat: that is UAT, which holds the family's data" ;;
  tohe) die "refusing to use the compose project tohe: that is the development stack; Mode C has its own (tohe-image)" ;;
esac

cd "$REPO"
compose=(docker compose -p "$PROJECT" -f compose.yaml -f compose.image.yaml)

if [[ "${1:-}" == "--down" ]]; then
  # The tag is only needed to read the override file.
  TOHE_IMAGE_TAG="${TOHE_IMAGE_TAG:-down}" "${compose[@]}" down --volumes --remove-orphans
  log "stopped $PROJECT and removed its database"
  exit 0
fi

REF="${1:-}"
if [[ -z "$REF" || "$REF" == -* ]]; then
  die "usage: pnpm stack:image <tag|commit>   |   pnpm stack:image --down"
fi

git fetch --quiet origin --tags || log "could not fetch from origin; using the refs this checkout already has"
COMMIT="$(git rev-parse --verify --quiet "$REF^{commit}")" \
  || die "'$REF' is not a tag, branch or commit this checkout knows (git fetch --tags, then try again)"
SHA="${COMMIT:0:12}"

export TOHE_IMAGE_TAG="sha-$COMMIT"
export TOHE_VERSION="$SHA"

# The same ports as the development stack: only one of them runs at a time.
if [[ -n "$(docker compose -p tohe ps -q 2>/dev/null)" ]]; then
  die "the development stack (compose project tohe) is running and uses the same ports; stop it first with: docker compose -p tohe down   (add -v to wipe its database), or stop 'pnpm dev'. Mode C was not started."
fi
running="$("${compose[@]}" ps -q 2>/dev/null || true)"
if [[ -z "$running" ]] && curl -fsS -o /dev/null --max-time 2 "$HUB/" 2>/dev/null; then
  die "something already answers on $HUB (pnpm dev, or another stack on the 47xx ports); stop it first. Mode C was not started."
fi

log "pulling the images of $REF ($SHA) from ghcr.io"
if ! "${compose[@]}" pull --quiet api hub games docs; then
  log "no images for $SHA on ghcr.io." >&2
  log "CI publishes them for a commit on main once its checks pass — wait for that, or pick a later commit. A commit from before" >&2
  log "CI published images has none at all: this script never builds, so there is nothing to run for it." >&2
  exit 1
fi

if [[ -n "$running" ]]; then
  # A Mode C stack from before — maybe of another tag, whose database an older commit's API may not understand: start clean.
  log "$PROJECT is already running; replacing it, database included (Mode C data is throwaway)"
  "${compose[@]}" down --volumes --remove-orphans
fi
"${compose[@]}" up -d --no-build --remove-orphans

log "waiting for $HUB/api/health"
for _ in $(seq 1 60); do
  if curl -fsS "$HUB/api/health" >/dev/null 2>&1; then
    version="$(curl -fsS "$HUB/api/config" | sed -E 's/.*"apiVersion":"([^"]*)".*/\1/')"
    log "healthy — commit $COMMIT"
    log "apiVersion $version"
    log "hub  $HUB    mail http://localhost:4760    demo data: pnpm seed (only for a commit that has it)"
    log "stop with: pnpm stack:image --down"
    exit 0
  fi
  sleep 2
done
log "the hub did not become healthy; recent API logs:" >&2
"${compose[@]}" logs --tail 40 api >&2
exit 1
