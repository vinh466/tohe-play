#!/bin/sh
# The Definition of Done, `pnpm verify`: Biome, then typecheck, test and build, then conformance one game at a time
# (the conformance kit times its checks, and several browsers at once on a small runner miss them).
# Arguments go to both turbo runs, e.g. --cache=local:w to run every task and only write the cache.
# CI runs the same checks split across jobs (.github/workflows/ci.yml: verify, api, one conformance job per game): a
# check added here goes there too.
set -e
biome check .
turbo run typecheck test build "$@"
turbo run conformance --concurrency=1 "$@"
