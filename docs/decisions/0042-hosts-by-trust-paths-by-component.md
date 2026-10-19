---
title: "0042: Lay out Tò He by trust: one domain, a host per trust boundary, a path per component"
description: One domain; each host is one trust boundary and one audience; inside a host each component owns a few path prefixes listed in one map that generates every routing config. The root serves static public pages and the app, the console moves to a host of its own behind Cloudflare Access, mail goes out from a subdomain and the status page lives elsewhere.
sidebar:
  order: 42
---

- **Status:** Accepted
- **Date:** 2026-10-19
- **Amends:** [ADR 0040](0040-all-of-tohe-on-one-domain-of-its-own.md) — the paths on the hub's host and three new
  hosts; [ADR 0027](0027-platform-admin-and-the-first-owner.md) — the console leaves `/admin/` for a host of its own;
  [ADR 0021](0021-release-production-through-the-tohe-chart.md) — the site image serves only the developer docs, at the
  root of its host

## Context

ADR 0040 put all of Tò He on `toheplay.io.vn`: the hub at the root with `/api` and `/admin/`, the games origin at
`games.`, and the site — the Vietnamese landing page and the English docs — at `docs.`. What runs on production since
2026-10-19 shows what that leaves open:

- **The name people type is a page machines cannot read.** The root is a single-page app: every path answers `200` with
  the same empty `index.html` — `/robots.txt`, `/sitemap.xml` and paths that do not exist included — and the HTML carries
  no description or Open Graph tags. Search engines render it; the crawlers behind AI answers do not run JavaScript.
- **The introduction lives with the developer docs**, at `docs.toheplay.io.vn/`, for a different audience in a different
  language.
- **The operator's console shares the players' origin.** A flaw in any page of the hub could act with an operator's
  session.
- **Paths are written by hand in five places**: the hub's router, about ten links and redirects in the API's identity
  module, the hub's Caddyfile, the service worker's configuration and the end-to-end tests. The hub owns thirteen prefixes
  at the root, so each new page is one more place two components can collide.
- **The app's identity is its start URL**: the manifest has no `id`, so moving `start_url` would make installed apps a
  different app.

The owner asked for one standard, chosen freely now that changing is cheap: "tôi cần 1 chuẩn hợp lý và hiệu quả … để
phân chia hợp lý + mở rộng kỹ thuật tốt". Three layouts were weighed against the product's needs — a newcomer playing
within seconds, short invitation links, one origin for the app and the player's session, pages that search engines and AI
can read, untrusted games kept apart, a protected console, mail that arrives, the same layout in every environment, room
to grow. The owner chose the one below and named the console's host.

## Decision

**Four layers.**

1. **One domain**, `toheplay.io.vn` (ADR 0040).
2. **A host is a trust boundary and an audience.** The browser isolates cookies, storage, service workers and
   permissions by origin, so a security boundary must be a host. Within one audience, more hosts only add CORS, sessions
   and redirects.
3. **Inside a host, a component owns a few path prefixes**, written in one map (`@tohe/routes`) that generates the routing
   of the hub's Caddy, the service worker's list of app pages, `robots.txt` and the API's links to the hub. A test fails
   when two namespaces overlap or a component serves a path outside its own.
4. **Common rules** for sessions, the API, headers, indexing, the app, mail, environments and configuration (below).

**The hosts.**

| Host | Role | Session |
| --- | --- | --- |
| `toheplay.io.vn` | Players: static public pages, the app, the API | `__Host-tohe.session` |
| `console.toheplay.io.vn` | Operators: the console and the API's console routes, behind Cloudflare Access | `__Host-tohe.console`, of its own |
| `games.toheplay.io.vn` | Game code, untrusted (ADR 0002, 0040) | none |
| `docs.toheplay.io.vn` | Developer documentation, at the root of the host | none |
| `status.toheplay.io.vn` | The status page, run by a service outside Tò He's infrastructure | none |
| `notify.toheplay.io.vn` | Sending transactional mail (no web) | — |
| `www.toheplay.io.vn` | A redirect to the root | — |

Kept for later, without DNS: `api.` (only for a public API with keys), `account.` (one sign-in shared by three or more of
Tò He's own origins), `studio.` (tools for making games, if they need permissions players do not have), `media.` (files
people upload; without cookies, or a domain of their own if the risk is high), `uat.` (UAT's names, below).

**The root's namespaces.**

| Namespace | Component | Served | Indexed |
| --- | --- | --- | --- |
| `/`, `/games/`, `/guides/`, `/faq`, `/about`, `/terms`, `/privacy` | public pages (`apps/web`) | static HTML | yes |
| `/play`, `/play/<gameId>/…` — only game ids under `/play/` | the app | the app's page | no |
| `/account/…` | the app: signing in and up, password, email, profiles, settings | the app's page | no |
| `/r/<code>`, `/s/<code>` | the app's short links: a table, a share (entry links) | the app's page | no |
| `/api/…` | the API | proxied | — |
| `/.well-known/…`, `/robots.txt`, `/sitemap.xml` | the platform | generated | — |
| anything else | — | a real `404` | — |

The app's manifest gets `id: "/"` and `start_url: "/play"`. English route names throughout; a public game page uses the
game's id (`/games/merge-block`).

**Common rules.**

- **Sessions (the backend-for-frontend pattern of RFC 10017):** each front door serves `/api` on its own origin. Session
  cookies are `__Host-`, `HttpOnly`, `Secure`, `Path=/`, and never carry a `Domain`; the players' is `SameSite=Lax`
  (links in mail, OAuth), the console's `SameSite=Strict`. No CORS.
- **One API, several front doors**; it knows its origins from configuration (`publicUrls`). A separate `api.` host only
  for third parties.
- **No third-party script** on the root or on `console.`; a CSP for each host and namespace.
- **HSTS** `max-age=31536000; includeSubDomains` — every host of the domain is HTTPS — and no preload list.
- **Indexing**: the public pages on the root and the docs; nothing else.
- **Mail** goes out from `notify.`; people write to `hello@` and `security@` at the root.
- **Environments keep the role names**: production `<role>.toheplay.io.vn`, one level deep (Cloudflare's free
  certificate); UAT, if it gets HTTPS, `uat.toheplay.io.vn` and `<role>.uat.toheplay.io.vn`, DNS-only to its private
  address with a DNS-01 certificate; development on `localhost` ports.
- **Hosts come from configuration**, never from code. **A new host needs an ADR; a new namespace is one line in the map.**

**Adding a component.** Another host when its code is not ours or not trusted, when it must stay up while Tò He is down,
or when its people, permissions or session differ from the players'. Otherwise a namespace on the root — served from the
hub's image, or by a service of its own behind the same prefix, which changes no URL.

## Consequences

- The work arrives in steps, each a pull request: the map and its generated configuration with real `404`s, `robots.txt`,
  `sitemap.xml`, `security.txt`, HSTS for subdomains and a switch for the API reference; the app's routes under `/play`
  and `/account`; the public pages as `apps/web` built into the hub's image, and the docs at the root of their host (the
  site app renamed `apps/docs`, the chart's `site` values renamed `docs`); the console's host; mail from `notify.` and the
  status page. Until each lands, the current layout stays in force for its part.
- Links already sent stay valid: `/r/<code>` keeps its form; links in mail that are still valid redirect to their new
  paths for a while.
- The console gets a sign-in of its own; an operator signed in as a player is not signed in to the console. Cloudflare
  Access asks first.
- `platform-infra` changes twice — the docs values and the console's host — in pull requests the owner merges.
- The status page shares the domain's DNS with Tò He, so a DNS failure takes both down; the owner's community channels are
  the fallback.
- Public pages share the app's origin: they carry no third-party code, and the service worker leaves them alone.

## Alternatives considered

- **Keep ADR 0040's paths and add meta tags and a `robots.txt` to the app.** Least work; the root would still be empty
  to the crawlers behind AI answers, and the introduction would stay with the developer docs.
- **The introduction at the root and the app at `play.`.** Two front doors for players: every link one hop longer, the
  app installed from another host, and the introduction unable to tell a returning player from a new one. Its one gain —
  an introduction that stays up while the cluster is down — can come later from routing paths at Cloudflare.
- **A host for everything** (`app.`, `api.`, `auth.` …). CORS and sessions across hosts for one audience, against the
  same-origin pattern of RFC 10017.
- **Rendering the app on the server.** A different framework for the hub to solve what static pages in front of it solve.
