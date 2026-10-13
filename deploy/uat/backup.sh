#!/usr/bin/env bash
# Dump the UAT database to $TOHE_UAT_BACKUPS (default ~/backups/tohe-uat), keeping the newest 20 dumps.
# Restore: gunzip -c <file> | docker compose -p tohe-uat exec -T postgres psql -U tohe -d tohe
set -euo pipefail

DIR="${TOHE_UAT_BACKUPS:-$HOME/backups/tohe-uat}"
mkdir -p "$DIR"
FILE="$DIR/tohe-$(date +%Y%m%d-%H%M%S).sql.gz"

docker compose -p tohe-uat exec -T postgres pg_dump -U tohe -d tohe --clean --if-exists | gzip >"$FILE"
printf '\033[1m[uat]\033[0m backup %s (%s)\n' "$FILE" "$(du -h "$FILE" | cut -f1)"

ls -1t "$DIR"/tohe-*.sql.gz | tail -n +21 | xargs -r rm --
