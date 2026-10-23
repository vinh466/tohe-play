# `tohe` Helm chart

Runs Tò He on Kubernetes: the hub (PWA, with `/api` proxied on the same origin), the operators' console (served by the
hub's pods on a host of its own), the API, the games origin and the developer docs — from scratch with its own PostgreSQL, or on infrastructure you already run
([ADR 0021](../../../docs/decisions/0021-release-production-through-the-tohe-chart.md)). Step-by-step:
[Self-hosting](../../../docs/guides/self-hosting.md). What each image reads: [Configuration](../../../docs/guides/configuration.md).

## Who owns what

| The chart | Whoever deploys it |
|---|---|
| Workloads, Services, Ingress, probes, security contexts | Namespace, release name, hostnames, DNS, TLS |
| The configuration and secret keys each image reads | What the secrets contain |
| The constraints below, enforced when it renders | Which version runs, upgrades, rollbacks, backups |

## Required values

| Value | What |
|---|---|
| `publicUrls.hub` | The hub's public URL (`https://…`, no path). The API answers under `/api` on it |
| `publicUrls.games` | The games origin — a different host from the hub's (ADR 0002), on a domain Tò He has to itself (ADR 0040) |
| `publicUrls.docs` | The developer docs, at the root of their own host, while `docs.enabled`. The hub's public home page links to it |
| `secrets.existingSecret` **or** `secrets.values.postgresPassword` | Where the secrets come from |

The hosts must differ: the Ingress routes by host, and the games origin must never share the hub's. Give Tò He
a domain of its own — production runs `toheplay.io.vn`, `games.toheplay.io.vn` and `docs.toheplay.io.vn`. Game code
is the same *site* as every host of its registrable domain, so it can set cookies they all receive: the hub protects
itself (a `__Host-` session cookie, same-origin checks on the API, `form-action 'none'` in the games' CSP); apps that
are not Tò He's may not ([Self-hosting](../../../docs/guides/self-hosting.md)).

## Infrastructure

`infra.postgres.mode`:

- `builtin` — a PostgreSQL 18 StatefulSet in the release, on a `ReadWriteOnce` volume. **Nothing backs it up.**
  For trying Tò He out and small self-hosting.
- `external` — a server you run: `external.host`, `external.port`, `external.sslMode`, the `database` and `username`
  values, and the password from the Secret; or the whole connection string from one key of the Secret
  (`external.connectionStringKey`). Keep `maxPoolSize` under the role's connection limit.

## Secrets

With `secrets.existingSecret`, that Secret must hold:

| Key | Required |
|---|---|
| `infra.postgres.passwordKey` (default `postgres-password`) | yes, unless `external.connectionStringKey` |
| `infra.postgres.external.connectionStringKey`, when set | yes |
| `telemetry-operator-token` | no — the telemetry report (ADR 0015) is off without it |
| `studio-storage-service-url`, `studio-storage-bucket`, `studio-storage-access-key`, `studio-storage-secret-key`, `studio-storage-public-base-url` | no — the Asset Studio's object storage (ADR 0051); without them its pack endpoints answer `503 studio_storage_not_configured` |

Without one, the chart renders a Secret from `secrets.values`. **Nothing is generated**: GitOps tools render charts
with `helm template`, where a generated value would change on every render. Pass the values in, e.g.
`--set secrets.values.postgresPassword=$(openssl rand -hex 24)`.

A rotated chart Secret rolls the API (a checksum annotation). An `existingSecret` does not: add Reloader's annotation
to `defaults.annotations` (it lands on the Deployments themselves, where Reloader looks) or restart by hand.

## Constraints the chart enforces

- **One API instance**, `Recreate` updates: rooms live in the API's memory, and its background jobs and start-up
  migrations assume one instance (ADR 0016). `api.replicaCount` other than 1 fails the render.
- **Host filtering**: `AllowedHosts` is the hub's host, and the console's when set (`api.allowedHosts` to change
  it); the probes send the hub's as `Host`.
- **The hub's public pages** ([ADR 0042](../../../docs/decisions/0042-hosts-by-trust-paths-by-component.md)): the hub
  serves a home page at its root, and `/sitemap.xml` and `robots.txt` with absolute URLs. The chart gives its pods
  `TOHE_HUB_URL` (from `publicUrls.hub`) and, while `docs.enabled`, `TOHE_DOCS_URL` (from `publicUrls.docs`), which the
  page's links to the developer docs use.
- **Unknown values fail** (`values.schema.json`), so a typo does not silently do nothing.
- **Behind a proxy**, set `hub.proxy.trustedProxies` to the ingress pods' range and `hub.proxy.clientIpHeaders` to the
  header carrying the visitor's address (`CF-Connecting-IP` behind Cloudflare). Keep the range narrow — anyone
  inside it can claim any address, and the API rate-limits sign-in by address.

## Off by default

- `publicUrls.console` — the operators' console ([ADR 0042](../../../docs/decisions/0042-hosts-by-trust-paths-by-component.md)),
  e.g. `https://console.tohe.example` beside `https://tohe.example`: a host of its own with a sign-in and a session of
  its own. Set, the hub's pods open their port 8081 (named `console`, on the hub's Service too), the Ingress leads the
  console's host there, the API gets `App__ConsoleUrl` and accepts the host in `AllowedHosts`, the games origin lets the
  console frame a game (to watch a ranked run), and `helm test` checks the console's page and that its routes ask for
  its session. Empty, none of that: the API answers the console's routes with 404. Put an access proxy in front of the
  host — production uses Cloudflare Access; the API does not check Access's token yet.

- `api.reference.enabled` — the API reference on the hub's origin: Scalar at `/api/docs` and the OpenAPI documents
  under `/api/openapi/`. Off, they answer 404; the docs carry the same reference, generated at build time
  ([ADR 0042](../../../docs/decisions/0042-hosts-by-trust-paths-by-component.md)).
- `hub.securityContact` — the address `/.well-known/security.txt` names for reporting vulnerabilities (RFC 9116).
  Empty, there is no `security.txt`.

The hub, the games origin and the docs send `Strict-Transport-Security` with `includeSubDomains`: once a browser has
seen it over HTTPS, every host under the hub's name must be HTTPS too — one more reason to give Tò He a domain of its
own.

## Extension points

On every component (`api`, `hub`, `games`, `docs`, with fallbacks in `defaults`): `annotations` (on the Deployment),
`podAnnotations`, `podLabels`, `nodeSelector`, `tolerations`, `affinity`, `priorityClassName`, `resources`,
`podSecurityContext`, `securityContext`, `extraEnv`. The API also has `config` (non-secret environment),
`extraEnvFrom`, `extraVolumes` and `extraVolumeMounts`. `ingress.enabled: false` leaves routing to you; the Services
are `<release>-hub`, `<release>-games`, `<release>-docs` on port 8080, and the console on `<release>-hub`'s port 8081.
`networkPolicy.enabled` lets only the hub reach the API and only the API reach the builtin PostgreSQL.

**Metrics** (ADR 0036): the API serves `/metrics` for Prometheus on its port `metrics` (9464), which no ingress
routes. With the Prometheus Operator's CRDs (kube-prometheus-stack), `metrics.serviceMonitor.enabled` scrapes it
(`interval`, and `labels` if your Prometheus selects ServiceMonitors by label) and `metrics.prometheusRule.enabled`
adds six alerts — the API not scraped, the database not answering (both critical), 5xx over 5 %, the 95th percentile
over 1 second, email stuck, a background worker failing 3 times in a row. With `networkPolicy.enabled` and the
ServiceMonitor on, only namespaces matching `metrics.scraperNamespaceLabels` reach the metrics port (empty: any). The
API image must be one that serves `/metrics`, or `ToheApiDown` fires.

## Images

`<global.image.registry>/<global.image.repository>/<component>:<tag>` — by default
`ghcr.io/vinh466/tohe-play/api:<tag>`. The tag is the component's, else `global.image.tag`, else the chart's
`appVersion`: a published chart carries its own commit's tag; a chart from a checkout needs `global.image.tag`.

CI publishes both for every commit on `main` that passed its checks: images `sha-<commit>`, and this chart as
`oci://ghcr.io/vinh466/charts/tohe`, version `<version in Chart.yaml>-g<short commit>`, `appVersion: sha-<commit>`.
Raise `version` in `Chart.yaml` when the chart's values change in a way installs must notice.

## Checking a change

```sh
deploy/helm/tohe/ci/check.sh   # lint + render every profile in ci/ + every guard
```

CI also installs `ci/standalone.yaml` on kind from images it builds, runs `helm test`, and upgrades in place.
