#!/usr/bin/env bash
# Lints and renders the chart with every profile in ci/, then checks that each guard fails with its message.
# Run from the repository root: deploy/helm/tohe/ci/check.sh (CI does, in the "Helm chart" job).
set -euo pipefail
chart=deploy/helm/tohe
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

for profile in "$chart"/ci/*.yaml; do
  name=$(basename "$profile" .yaml)
  helm lint --strict "$chart" -f "$profile" >"$out/lint-$name.txt" || { cat "$out/lint-$name.txt"; exit 1; }
  helm template tohe "$chart" -f "$profile" >"$out/$name.yaml"
  echo "ok  $name: $(grep -c '^kind:' "$out/$name.yaml") objects"
done

# A guard must fail, and say why. expect_failure <message fragment> <helm --set arguments…>
expect_failure() {
  local fragment=$1
  shift
  if helm template tohe "$chart" -f "$chart/ci/standalone.yaml" "$@" >"$out/guard.yaml" 2>"$out/guard.txt"; then
    echo "FAIL rendered although it should not: $*"
    exit 1
  fi
  if ! grep -qF -- "$fragment" "$out/guard.txt"; then
    echo "FAIL wrong message for $*:"
    cat "$out/guard.txt"
    exit 1
  fi
  echo "ok  refuses: $fragment"
}

expect_failure "publicUrls.hub is required" --set publicUrls.hub=
# The schema catches a path before the templates do; Helm 3 and 4 word it differently, both say "match pattern".
expect_failure "match pattern" --set publicUrls.games=https://g.example.test/path
expect_failure "publicUrls.site is required" --set publicUrls.site=
expect_failure "must use a different host each" --set publicUrls.games=https://tohe.example.test
expect_failure "api.replicaCount must be 1" --set api.replicaCount=2
expect_failure "secrets.values.postgresPassword is required" --set secrets.values.postgresPassword=
expect_failure "must not contain" --set 'secrets.values.postgresPassword=a;b'
expect_failure "external.host is required" --set infra.postgres.mode=external
expect_failure "connectionStringKey names a key of secrets.existingSecret" \
  --set infra.postgres.mode=external --set infra.postgres.external.connectionStringKey=x
# A typo is an unknown key, which the schema rejects (the message names it in Helm 3 and 4).
expect_failure "replicas" --set api.replicas=2
expect_failure "builtin" --set infra.postgres.mode=sqlite
echo "chart checks passed"
