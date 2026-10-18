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
  different host from the hub's ([ADR 0002](../decisions/0002-games-in-sandboxed-iframe-on-own-origin.md)). HTTPS
  is strongly advised: the session cookie is only `Secure` on an `https` hub URL.
- The images. Build and push them to a registry your cluster can pull from:

```sh
docker build -f deploy/docker/api.Dockerfile -t registry.example.org/tohe/api:1 .
for target in hub games site; do
  docker build -f deploy/docker/web.Dockerfile --target "$target" -t "registry.example.org/tohe/$target:1" .
done
# docker push … each of the four
```

## From scratch

The chart's own PostgreSQL (`infra.postgres.mode: builtin`) and its own Secret. Nothing is generated for you — pass
the secrets in:

```sh
helm install tohe deploy/helm/tohe --namespace tohe --create-namespace \
  --set publicUrls.hub=https://tohe.example.org \
  --set publicUrls.games=https://tohe-games.example.org \
  --set publicUrls.site=https://tohe-site.example.org \
  --set global.image.registry=registry.example.org --set global.image.repository=tohe --set global.image.tag=1 \
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
  games: https://tohe-games.example.org
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

## Updating

`helm upgrade` with a new `global.image.tag`. The API stops before the new one starts (one instance — online rooms
live in its memory) and migrates the database on start; open rooms rebuild from PostgreSQL
([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md)). Take a backup first if you run the builtin
database.
