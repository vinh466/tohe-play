#!/usr/bin/env bash
# What a pull request touches decides what CI runs for it (docs/guides/environments.md#continuous-integration):
#   notes  only plan notes, agent and skill definitions, the root's notes for agents — nothing is built from them
#   docs   the spec under docs/ as well — the docs app is built, which checks every link
#   all    anything else — every check
# A push (main) is always `all`. Env: EVENT (github.event_name), BASE and HEAD (the pull request's commits).
# Prints scope=<value>, for $GITHUB_OUTPUT.
set -euo pipefail

scope=all
if [ "${EVENT:-}" = pull_request ]; then
  scope=notes
  # Three dots: what the pull request changed since it left its base, not what the base did since.
  while IFS= read -r file; do
    case "$file" in
      '') ;;
      plans/* | .claude/* | AGENTS.md | CLAUDE.md | README.md) ;;
      docs/*) scope=docs ;;
      *)
        scope=all
        break
        ;;
    esac
  done < <(git diff --name-only "$BASE...$HEAD")
fi
echo "scope=$scope"
