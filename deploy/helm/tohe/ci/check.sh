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
expect_failure "match pattern" --set hub.securityContact=security
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
expect_failure "match pattern" --set publicUrls.console=https://console.example.test/admin
expect_failure "must use a different host each" --set publicUrls.console=http://tohe.example.test

# The console (ADR 0042): with publicUrls.console, the API learns it, the hub's pods open their console port, an
# ingress rule leads its host there and the games origin lets it frame a game; without it, none of that.
expect_render() {
  local what=$1 file=$2 pattern=$3
  if ! grep -qE -- "$pattern" "$file"; then
    echo "FAIL $what: no match for $pattern"
    exit 1
  fi
  echo "ok  $what"
}
expect_no_render() {
  local what=$1 file=$2 pattern=$3
  if grep -qE -- "$pattern" "$file"; then
    echo "FAIL $what: unexpected $pattern"
    exit 1
  fi
  echo "ok  $what"
}
production="$out/platform-infra.yaml"
expect_render "the console's URL reaches the API" "$production" 'value: "https://console.toheplay.io.vn"'
expect_render "the API accepts the console's host" "$production" 'value: "toheplay.io.vn;console.toheplay.io.vn"'
expect_render "the console's host has an ingress rule" "$production" '^    - host: console.toheplay.io.vn$'
expect_render "the hub's Service has the console port" "$production" '^    - name: console$'
expect_render "the console may frame games" "$production" 'value: https://toheplay.io.vn https://console.toheplay.io.vn$'
helm template tohe "$chart" -f "$chart/ci/standalone.yaml" --set publicUrls.console= >"$out/no-console.yaml"
expect_no_render "no console: no App__ConsoleUrl" "$out/no-console.yaml" 'App__ConsoleUrl'
expect_no_render "no console: no console port" "$out/no-console.yaml" '8081'
echo "chart checks passed"
