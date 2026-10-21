#!/usr/bin/env bash
# What CI runs (docs/guides/environments.md#continuous-integration). What a pull request touches decides the scope:
#   notes  only plan notes, agent and skill definitions, the root's notes for agents — nothing is built from them
#   docs   the spec under docs/ as well — the docs app is built, which checks every link
#   all    anything else — every check
# A push (main) is always `all`. Env: EVENT (github.event_name), BASE and HEAD (the pull request's commits).
# The games are the folders in games/ whose package.json has a conformance script: CI checks each on a runner of its own,
# so a new game is checked without touching the workflow.
# Prints scope=<value> and games=<JSON list of folder names>, for $GITHUB_OUTPUT.
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
echo "games=$(jq -c -n '[inputs | select(.scripts.conformance) | input_filename | split("/")[1]]' games/*/package.json)"
