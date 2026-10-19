---
title: Configuration
description: What each of the four images reads when it starts — the same images run locally, on UAT and in production.
sidebar:
  order: 6
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
| `App:PublicUrl` | The hub's public URL, e.g. `https://tohe.example.org` — no path. With `https`, every request counts as HTTPS and the session cookie is `Secure`, named `__Host-tohe.session`. Emails link to the hub's pages under it | unset: requests stay as they arrive, emails carry codes without links (development: `http://localhost:4720`) |
| `App:ConsoleUrl` | The console's public URL, e.g. `https://console.tohe.example.org` — a host (or, locally and on UAT, a port) of its own, no path ([ADR 0042](../decisions/0042-hosts-by-trust-paths-by-component.md)). The API answers its console routes, `/api/admin/…`, on that host alone, and nothing else there; with `https` the console's cookie is `Secure`, named `__Host-tohe.console`. The startup log names `<App:ConsoleUrl>/setup` while a deployment has no owner ([Admin console](../architecture/admin.md#the-consoles-session)) | unset: the console's routes answer 404, and the log says so once (development: `http://localhost:4721`) |
| `App:Version` | The commit the deployment built, shown by `GET /api/config` | the assembly's version, or `dev` |
| `Api:Reference:Enabled` | Serve the API reference: Scalar at `/api/docs` and the OpenAPI documents under `/api/openapi/`. Off, they answer 404; the docs site carries the same reference, generated at build time ([ADR 0042](../decisions/0042-hosts-by-trust-paths-by-component.md)) | `true` in Development, `false` elsewhere (compose: `true`) |
| `Games:PublicOrigin` | Origin browsers load game iframes from | — required |
| `Games:CatalogUrl` | Where the API fetches `catalog.json` (often an internal address) | — required |
| `Registry:SyncInterval` | How often the catalog is fetched | `00:05:00` |
| `Telemetry:Enabled` | Server switch for device telemetry ([ADR 0015](../decisions/0015-device-telemetry.md)) | `true` |
| `Telemetry:OperatorToken` | Token for `GET /api/telemetry/report` | empty: no reports |
| `Identity:AuthRequestsPerMinute` | Requests per client address and minute in each of three buckets: signing in or asking for a code, typing a code back, a PIN or the parent gate (ADR 0024) | `10` |
| `Identity:SessionCheckInterval` | How often a session is checked against its account's security stamp: after a password reset or an email change, other sessions end within this long | `00:05:00` |
| `Email:Mode` | `Smtp` to send email, `Disabled` to send none — features that need email are then unavailable ([ADR 0022](../decisions/0022-send-transactional-email-through-an-outbox.md)) | `Disabled` (compose: Mailpit) |
| `Email:From` | The sender, e.g. `Tò He <no-reply@example.org>` — an address the relay may send as | — required with `Smtp` |
| `Email:Smtp:Host`, `Email:Smtp:Port`, `Email:Smtp:Security` | The relay; `Security` is `StartTls` (587), `SslOnConnect` (465) or `None` (a relay on the same network, like Mailpit) | —, `587`, `StartTls` |
| `Email:Smtp:Username`, `Email:Smtp:Password` | The relay's credentials (Resend: `resend` and an API key) | empty: no authentication |
| `Auth:Providers:Google:ClientId`, `Auth:Providers:Google:ClientSecret` | Google sign-in ([ADR 0026](../decisions/0026-sign-in-methods-and-account-linking.md)): an OAuth client of type *Web application* with the redirect URI `<App:PublicUrl>/api/auth/external/google/callback`; step by step in [Sign in with Google](sign-in-with-google.md) | unset: no Google |
| `Auth:Providers:GitHub:ClientId`, `Auth:Providers:GitHub:ClientSecret` | GitHub sign-in: an OAuth app with the callback URL `<App:PublicUrl>/api/auth/external/github/callback` | unset: no GitHub |
| `Auth:Providers:Oidc:Authority`, `…:ClientId`, `…:ClientSecret`, `…:DisplayName` | One more OpenID Connect issuer (Dex, Keycloak…): its issuer URL, a confidential client with the redirect URI `<App:PublicUrl>/api/auth/external/oidc/callback`, and the name on its button | unset: none; the name defaults to `OpenID` |
| `Auth:Providers:Oidc:RequireHttpsMetadata` | `false` only for a test issuer on plain HTTP | `true` |
| `Rooms:*` | Timers, bots and limits of online rooms ([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md)) | see `RoomsOptions` |
| `Integrity:Replays`, `Integrity:ReplayInterval` | Replay ranked runs in the background, and how often to look for new ones ([ADR 0030](../decisions/0030-ranked-runs-replayed-by-the-server.md)) | `true`, `00:00:05` |
| `Admin:SetupToken` | The token that makes a new deployment's first owner, at the console's `/setup` ([Admin console](../architecture/admin.md#the-first-owner)); keep it in the secret store | unset: made up at start and logged once while there is no owner |
| `Admin:BootstrapEmails` | Addresses allowed to become the first owner (`Admin__BootstrapEmails__0`, `__1`…) | empty: any confirmed address with the token |

The API trusts the `X-Forwarded-For` the hub sends, so nothing but the hub may reach it. Its host filtering
(`AllowedHosts`) must let both the hub's host and the console's through: the hub's Caddy passes the visitor's `Host` on,
and the API tells the console's requests by it.

A provider exists only with both its client ID and secret; the admin console then switches it on and off, as it does
email and password, and decides who may sign up ([ADR 0028](../decisions/0028-sign-in-and-registration-at-run-time.md),
[Admin console](../architecture/admin.md#sign-in-and-registration)). `GET /api/config` lists the providers that exist
and are on. Providers need
`App:PublicUrl` with `https`: the redirect URI is built from the request — HTTPS, because of `App:PublicUrl`, and the
host the browser used — so players reach the hub at that address, and the providers' own cookies are `Secure`.
UAT and local development go without them (a developer may register an app for `http://localhost:4720`).

## Hub

| Variable | What | Default |
| --- | --- | --- |
| `API_UPSTREAM` | `host:port` of the API, proxied at `/api` | — required |
| `GAMES_ORIGIN` | Origin of the game iframes, written into the CSP — the same as the API's `Games:PublicOrigin` | — required |
| `TOHE_TRUSTED_PROXIES` | Space-separated CIDRs of proxies in front of the hub that may say who the visitor is — e.g. a cluster's ingress pods | `127.0.0.1/32`: nobody, the hub is the edge |
| `TOHE_CLIENT_IP_HEADERS` | Headers those proxies carry the visitor's address in, e.g. `CF-Connecting-IP` behind Cloudflare | `X-Forwarded-For` |
| `TOHE_SECURITY_CONTACT` | The address `/.well-known/security.txt` (RFC 9116) names for reporting vulnerabilities, e.g. `security@toheplay.io.vn`. The file's `Expires` is written on each request, 360 days ahead | unset: no `security.txt` (404) |

Keep `TOHE_TRUSTED_PROXIES` narrow: anyone inside a trusted range can claim any address, and the API rate-limits
sign-in by address.

Which path the hub serves, and how, comes from the map in `@tohe/routes`
([Hosts and paths](../architecture/hosts-and-paths.md)): the app's pages get its `index.html` with
`X-Robots-Tag: noindex`, its files are served as they are, `/api/` is proxied, `/robots.txt` keeps crawlers out of the
API, and any other path — `/admin` among them — answers a real `404` with a small page of its own.

The same image serves the console on a second site, port **8081**, for the console's host: its page at the root of its
namespaces, its files, and the API's console routes `/api/admin/…` proxied to `API_UPSTREAM` — nothing else, a `404`
for the rest — with a CSP of its own (`GAMES_ORIGIN` framed only to watch a ranked run) and
`X-Robots-Tag: noindex, nofollow`. Publish that port where the console's host leads (compose: `4721`; UAT: `4821`; the
chart: the hub Service's port `console`).

## Games

| Variable | What | Default |
| --- | --- | --- |
| `HUB_ORIGINS` | Space-separated origins allowed to embed games (`frame-ancestors`): the hub's, and the console's, which frames a game to watch a ranked run | — required |
| `PUBLIC_HUB_URL` | The hub's origin: the games origin's own front page (`/`) leads to its `/play` | — required |

Every response of the games origin carries `X-Robots-Tag: noindex, nofollow`: a game page is meant only inside the
hub's frame ([ADR 0039](../decisions/0039-games-on-a-domain-of-their-own.md)).

## Site

| Variable | What | Default |
| --- | --- | --- |
| `PUBLIC_HUB_URL` | The hub's origin: the landing page's play button (`/play`) leads to the hub's `/play` | unset: the site's own home page |
| `TOHE_SITE_URL` | The site's own URL, for canonical links, the sitemap and `llms.txt` | empty: relative links |

## In the Helm chart

The chart sets all of the above from its values ([Self-hosting](self-hosting.md)): `publicUrls.*` give
`App:PublicUrl`, `Games:PublicOrigin`, `GAMES_ORIGIN`, `HUB_ORIGINS`, `PUBLIC_HUB_URL` and `TOHE_SITE_URL`;
`publicUrls.console` gives `App:ConsoleUrl`, the console's host in `AllowedHosts` and `HUB_ORIGINS`, the hub's port
`console` and an Ingress rule for it — empty, none of them (production: `https://console.toheplay.io.vn`);
`hub.proxy.*` give `TOHE_TRUSTED_PROXIES` and `TOHE_CLIENT_IP_HEADERS`; `hub.securityContact` gives
`TOHE_SECURITY_CONTACT`; `api.reference.enabled` gives `Api:Reference:Enabled` (default `false`); `infra.postgres.*`
and the Secret give `ConnectionStrings:Database`; `api.config` adds any other API key.

## Every web origin

The hub, the console, the games origin and the site send `Strict-Transport-Security: max-age=31536000; includeSubDomains`, and
Tò He is not on the preload list: every host of its domain is Tò He's and served over HTTPS
([ADR 0042](../decisions/0042-hosts-by-trust-paths-by-component.md)). Browsers ignore it over plain HTTP, so it only
takes effect where the origin is served over HTTPS.
