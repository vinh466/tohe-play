#!/bin/sh
# The Definition of Done, `pnpm verify`: Biome, then typecheck, test and build, then conformance one game at a time
# (the conformance kit times its checks, and several browsers at once on a small runner miss them).
# Arguments go to both turbo runs: CI passes --cache=local:w on main, so main runs every task and only writes the cache.
set -e
biome check .
turbo run typecheck test build "$@"
turbo run conformance --concurrency=1 "$@"
