---
title: Self-hosting on Kubernetes
description: Install Tò He with its Helm chart — from scratch with its own PostgreSQL, or on a database and secrets you already run.
sidebar:
  order: 6
---

The `tohe` chart in [`deploy/helm/tohe`](https://github.com/vinh466/tohe-play/tree/main/deploy/helm/tohe) runs the
four images — hub, API, games origin, site — on Kubernetes
([ADR 0021](../decisions/0021-release-production-through-the-tohe-chart.md)). Its README lists every value; this page
walks through an install. What each image reads: [Configuration](configuration.md).

## What you need

- Kubernetes 1.29 or later, `helm`, and an ingress controller (or your own routing — `ingress.enabled: false`).
- Three hostnames pointing at the ingress: the hub, the games origin and the site. The games origin must be a
  different host from the hub's ([ADR 0002](../decisions/0002-games-in-sandboxed-iframe-on-own-origin.md)), best on
  a domain of its own ([below](#the-games-origin)). HTTPS is strongly advised: the session cookie is only `Secure` on
  an `https` hub URL.
- Nothing to build. CI publishes every commit on `main` that passed its checks: the four images,
  `ghcr.io/vinh466/tohe-play/<api|hub|games|site>:sha-<commit>`, and the chart,
  `oci://ghcr.io/vinh466/charts/tohe` with version `<x.y.z>-g<short commit>`, whose images default to its own
  commit's. Both are public; the versions are listed under the repository's **Packages** on GitHub.

Your own build instead — a fork, a patch — goes to a registry your cluster can pull from, and the chart is told
where:

```sh
docker build -f deploy/docker/api.Dockerfile -t registry.example.org/tohe/api:1 .
for target in hub games site; do
  docker build -f deploy/docker/web.Dockerfile --target "$target" -t "registry.example.org/tohe/$target:1" .
done
# docker push … each of the four, then add to the commands below:
#   --set global.image.registry=registry.example.org --set global.image.repository=tohe --set global.image.tag=1
```

## From scratch

The chart's own PostgreSQL (`infra.postgres.mode: builtin`) and its own Secret. Nothing is generated for you — pass
the secrets in:

```sh
helm install tohe oci://ghcr.io/vinh466/charts/tohe --version 0.1.0-g1a2b3c4 \
  --namespace tohe --create-namespace \
  --set publicUrls.hub=https://tohe.example.org \
  --set publicUrls.games=https://tohe-games.example.net \
  --set publicUrls.site=https://tohe-site.example.org \
  --set secrets.values.postgresPassword="$(openssl rand -hex 24)" \
  --wait --timeout 10m
helm --namespace tohe test tohe
```

Keep the password: with `helm upgrade`, pass the same value again (`--reuse-values`), or the API and the database
will disagree.

The builtin PostgreSQL is **not backed up** by anything. Dump it yourself:

```sh
kubectl --namespace tohe exec statefulset/tohe-postgres -- pg_dump -U tohe -d tohe > tohe.sql
```

`helm uninstall` keeps its volume (the StatefulSet's PersistentVolumeClaim); delete it when you mean to.

## On a database and secrets you already run

Point the chart at your PostgreSQL and a Secret you manage — the shape production uses on the `platform-infra`
cluster:

```yaml
publicUrls:
  hub: https://tohe.example.org
  games: https://tohe-games.example.net # a domain of its own (see below)
  site: https://tohe-site.example.org
infra:
  postgres:
    mode: external
    maxPoolSize: 8 # under the role's connection limit
    external:
      host: postgres-rw.data.svc.cluster.local
secrets:
  existingSecret: tohe-secrets # keys: postgres-password, and optionally telemetry-operator-token
defaults:
  annotations:
    reloader.stakater.com/auto: "true" # roll pods when the Secret changes
```

If you hand out whole connection strings instead, put one in the Secret and set
`infra.postgres.external.connectionStringKey` to its key.

## The games origin

Games run in a sandboxed iframe on an origin of their own, which never reaches the hub's cookies or storage
([ADR 0002](../decisions/0002-games-in-sandboxed-iframe-on-own-origin.md)). Give that origin a **registrable domain
of its own** when you can — `tohe-games.example.net` beside `tohe.example.org`, as production runs `toheplay.io.vn`
beside `tohe.vinetic.io.vn` ([ADR 0039](../decisions/0039-games-on-a-domain-of-their-own.md)). On a sibling
subdomain, game code is on the same *site* as every app of that domain — the
[Public Suffix List](https://publicsuffix.org/) decides what a site is — so it can set cookies they all receive, and
its requests to them carry their `SameSite` cookies. Tò He protects itself either way (a `__Host-` session cookie on
HTTPS, same-origin checks on the API); your other apps may not.

The games origin's front page (`/`) leads to the hub, and it tells search engines to leave it out
(`X-Robots-Tag: noindex, nofollow`): a game page is meant only inside the hub's frame.

Choose it before people install the hub. Changed later, installed hubs keep serving the page their service worker
cached, whose CSP names the old origin, until they take a newer hub build.

## Behind a proxy or CDN

When TLS ends in front of the ingress — Cloudflare, for example — the hub only sees the proxy's address. Tell it
which proxies to believe and where they put the visitor's address, so the API's per-address sign-in limit stays per
visitor:

```yaml
hub:
  proxy:
    trustedProxies: [10.42.0.0/16] # the ingress controller's pods; keep it narrow
    clientIpHeaders: [CF-Connecting-IP]
```

The API never needs `X-Forwarded-Proto` to know it is on HTTPS: `publicUrls.hub` says so.

On Cloudflare, the games origin's domain is a zone of its own: give it the same SSL/TLS mode as the hub's zone, and
"Always Use HTTPS". Leave off, on that zone, what breaks games framed by another site:

| Setting | Why it stays off |
| --- | --- |
| Bot Fight Mode, "I'm Under Attack", WAF challenges | A challenge cannot be passed inside the hub's frame — its cookie is a third-party cookie there, which Safari and Firefox block — so the game never loads |
| Hotlink Protection | The hub shows game icons from the games origin, with the hub as referrer |
| Rocket Loader, Web Analytics' automatic setup, Email Address Obfuscation | They rewrite a game's pages or add scripts it does not ship: a game runs its own build and nothing else |

## Metrics and alerts

The API serves Prometheus metrics on a port of its own, 9464, which no ingress routes (ADR 0036). If the cluster runs
the Prometheus Operator — kube-prometheus-stack, for example:

```yaml
metrics:
  serviceMonitor:
    enabled: true
    labels: {} # e.g. { release: kube-prometheus-stack } if your Prometheus selects by label
  prometheusRule:
    enabled: true # six alerts: the API or the database down, 5xx, slowness, stuck email, a failing worker
  scraperNamespaceLabels: { kubernetes.io/metadata.name: monitoring } # with networkPolicy.enabled
```

Who receives the alerts is your Alertmanager's configuration. The chart's README lists the alerts.

## Updating

`helm upgrade` to a newer chart version (its images come with it), or with a new `global.image.tag` on the same
chart. The API stops before the new one starts (one instance — online rooms
live in its memory) and migrates the database on start; open rooms rebuild from PostgreSQL
([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md)). Take a backup first if you run the builtin
database.
