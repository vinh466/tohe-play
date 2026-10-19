#!/usr/bin/env bash
# Fill a development database with demo accounts, profiles and scores (`dotnet Tohe.Api.dll dev seed`).
#
#   pnpm seed
#
# Runs the command where the development API is:
#   Mode B   inside the api container of the `tohe` compose project
#   Mode C   inside the api container of the `tohe-image` project (only for a commit that has the command)
#   Mode A   `dotnet run` against the database of the `tohe` project (docker compose up -d postgres), no container needed
# It never touches UAT (`tohe-uat`) or production: the command refuses outside the Development environment and without
# Dev:SeedAllowed, which only development configuration sets. Safe to run again. See docs/guides/local-development.md.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
cd "$REPO"

log() { printf '\033[1m[seed]\033[0m %s\n' "$*"; }

# The id of the running api container of a local project, or nothing.
api_container() { docker compose -p "$1" ps --status running -q api 2>/dev/null || true; }

for project in tohe tohe-image; do
  container="$(api_container "$project")"
  if [[ -n "$container" ]]; then
    log "seeding the database of the $project stack (Mode $([[ $project == tohe ]] && echo B || echo C))"
    # The containers run as Production; this one command is asked to run as Development, which the command requires.
    exec docker exec -e ASPNETCORE_ENVIRONMENT=Development "$container" dotnet Tohe.Api.dll dev seed
  fi
done

if [[ -n "$(docker compose -p tohe ps --status running -q postgres 2>/dev/null || true)" ]]; then
  log "no api container is up: seeding the development database through dotnet run (Mode A)"
  ASPNETCORE_ENVIRONMENT=Development exec dotnet run --project services/api/src/Tohe.Api -- dev seed
fi

log "no local stack is running. Start one first:" >&2
log "  Mode A  docker compose up -d postgres mailpit   (then pnpm seed again, or pnpm dev first)" >&2
log "  Mode B  docker compose up --build -d" >&2
log "  Mode C  pnpm stack:image <tag|commit>" >&2
exit 1
