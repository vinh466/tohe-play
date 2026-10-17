---
title: Configuration
description: What each of the four images reads when it starts — the same images run locally, on UAT and in production.
sidebar:
  order: 5
---

Tò He ships four images — `api`, `hub`, `games`, `site` — and the same build runs in every environment
([ADR 0021](../decisions/0021-release-production-through-the-tohe-chart.md)). Everything that differs between
environments is read when a container starts. Local values live in `compose.yaml`, UAT's in `compose.uat.yaml`
(secrets in `~/.config/tohe-uat/uat.env`, see [UAT](uat.md)).

## API

ASP.NET Core configuration: a key `Section:Key` is the environment variable `Section__Key`.

| Key | What | Default |
| --- | --- | --- |
| `ConnectionStrings:Database` | PostgreSQL connection string | — required |
| `Database:MigrateOnStartup` | Apply pending migrations when the API starts | `false` (compose and UAT: `true`) |
| `App:PublicUrl` | The hub's public URL, e.g. `https://tohe.example.org` — no path. With `https`, every request counts as HTTPS and the session cookie is `Secure`, named `__Host-tohe.session` | unset: requests stay as they arrive |
| `App:Version` | The commit the deployment built, shown by `GET /api/config` | the assembly's version, or `dev` |
| `Games:PublicOrigin` | Origin browsers load game iframes from | — required |
| `Games:CatalogUrl` | Where the API fetches `catalog.json` (often an internal address) | — required |
| `Registry:SyncInterval` | How often the catalog is fetched | `00:05:00` |
| `Telemetry:Enabled` | Server switch for device telemetry ([ADR 0015](../decisions/0015-device-telemetry.md)) | `true` |
| `Telemetry:OperatorToken` | Token for `GET /api/telemetry/report` | empty: no reports |
| `Identity:AuthRequestsPerMinute` | Sign-in, registration, PIN and parent-gate requests per client address | `10` |
| `Rooms:*` | Timers, bots and limits of online rooms ([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md)) | see `RoomsOptions` |

The API trusts the `X-Forwarded-For` the hub sends, so nothing but the hub may reach it.

## Hub

| Variable | What | Default |
| --- | --- | --- |
| `API_UPSTREAM` | `host:port` of the API, proxied at `/api` | — required |
| `GAMES_ORIGIN` | Origin of the game iframes, written into the CSP | — required |
| `TOHE_TRUSTED_PROXIES` | Space-separated CIDRs of proxies in front of the hub that may say who the visitor is — e.g. a cluster's ingress pods | `127.0.0.1/32`: nobody, the hub is the edge |
| `TOHE_CLIENT_IP_HEADERS` | Headers those proxies carry the visitor's address in, e.g. `CF-Connecting-IP` behind Cloudflare | `X-Forwarded-For` |

Keep `TOHE_TRUSTED_PROXIES` narrow: anyone inside a trusted range can claim any address, and the API rate-limits
sign-in by address.

## Games

| Variable | What | Default |
| --- | --- | --- |
| `HUB_ORIGINS` | Space-separated hub origins allowed to embed games (`frame-ancestors`) | — required |

## Site

| Variable | What | Default |
| --- | --- | --- |
| `PUBLIC_HUB_URL` | Where the landing page's play button (`/play`) leads | `/`: the site's own home page |
| `TOHE_SITE_URL` | The site's own URL, for canonical links, the sitemap and `llms.txt` | empty: relative links |

## In the Helm chart

The chart sets all of the above from its values ([Self-hosting](self-hosting.md)): `publicUrls.*` give
`App:PublicUrl`, `Games:PublicOrigin`, `GAMES_ORIGIN`, `HUB_ORIGINS`, `PUBLIC_HUB_URL` and `TOHE_SITE_URL`;
`hub.proxy.*` give `TOHE_TRUSTED_PROXIES` and `TOHE_CLIENT_IP_HEADERS`; `infra.postgres.*` and the Secret give
`ConnectionStrings:Database`; `api.config` adds any other API key.

## Every web origin

The hub, the games origin and the site send `Strict-Transport-Security: max-age=31536000` (no
`includeSubDomains`). Browsers ignore it over plain HTTP, so it only takes effect where the origin is served over
HTTPS.
