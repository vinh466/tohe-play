---
title: "0040: Run all of Tò He on toheplay.io.vn, the games one level below the hub"
description: Nothing of Tò He stays on vinetic.io.vn — the hub at toheplay.io.vn, the games origin at games.toheplay.io.vn, the site at docs.toheplay.io.vn. The games are then the same site as the hub, which protects itself — a __Host- session cookie, same-origin checks on the API, and form-action 'none' added to the games' CSP — and no app that is not Tò He's shares the domain.
sidebar:
  order: 40
---

- **Status:** Accepted
- **Date:** 2026-10-19
- **Amends:** [ADR 0039](0039-games-on-a-domain-of-their-own.md) — the games origin is `games.toheplay.io.vn`, a
  subdomain of the hub's domain, rather than a domain apart from the hub's; the Game Contract's CSP gains
  `form-action 'none'`

## Context

ADR 0039 moved the games origin off `vinetic.io.vn` to `toheplay.io.vn` and left the hub and the site on
`vinetic.io.vn`: the games were a site apart from both the hub and the apps that are not Tò He's (`auth`, `platform`,
`wiki`). On 2026-10-18 the owner asked for every host of Tò He under `toheplay.io.vn` ("ta sẽ không dính tới vinetic
nữa") and, of the two layouts offered — everything on one domain, or the games on a second domain — chose one domain:
"phương án 1, hãy giúp tôi làm tận gốc nhé". Mail already goes from `no-reply@toheplay.io.vn`, verified in Resend for
Tò He.

On one domain the games origin is the same site as the hub, as it already is locally and on UAT, where only the port
differs. What that opens, and what closes it:

- **Cookies the games set for the domain reach the hub.** The session cookie is `__Host-tohe.session` on HTTPS, which
  no other host can set or shadow (ADR 0021). The hub's other cookies are host-only and either harmless (the theme) or
  sealed with Data Protection (an external sign-in in progress), so nothing forged passes for them.
- **A game page's requests to the hub are same-site**, so the `SameSite=Lax` session cookie goes along. Framed by the
  hub, a game is sandboxed without `allow-forms` and its CSP lets it load nothing from elsewhere; the API refuses a
  state-changing request whose `Sec-Fetch-Site` is not `same-origin` (ADR 0011). What was left: a game page opened in
  a tab of its own, unsandboxed, submitting a form — in a browser that sends no `Sec-Fetch-Site` (Safari before 16.4),
  that request would reach the API with the session.
- **A site shares its reputation**: games, hub and mail stand or fall together — all of them Tò He's.

## Decision

- **Production hosts**: the hub at `https://toheplay.io.vn` — the root, the name people type and share, with `/api`
  and `/admin/` on it; the games origin at `https://games.toheplay.io.vn`; the site at `https://docs.toheplay.io.vn`.
  One level down, which Cloudflare's free certificate covers. `www.toheplay.io.vn` redirects to the root, at
  Cloudflare. Nothing of Tò He stays on `vinetic.io.vn`.
- **`toheplay.io.vn` holds Tò He alone**: no app that is not Tò He's on any host of it. ADR 0039's line — game code
  never on a site with apps that are not Tò He's — now runs around the domain instead of around the games.
- **The Game Contract's CSP gains `form-action 'none'`**: a game page submits no form anywhere, which closes the one
  path above. Not a protocol change: no game submits a form, and the conformance kit serves every game with the
  current CSP.
- **The defences stay, and now cover production too**: the `__Host-` cookie, `SameOriginGuard`, the sandbox, the
  games' CSP; the games origin's `/` leads to the hub and says `noindex` (ADR 0039).
- **Not done here:** a second domain for the games (the owner's other option); per-host Cloudflare rules.

## Consequences

- Cloudflare's settings belong to the zone, and the hub now shares the games' zone: Bot Fight Mode, "I'm Under
  Attack" and WAF challenges stay off for the whole domain — a challenge answers the games' files or the hub's API
  calls with a page only a person can pass. The hub keeps its own proof-of-work (ADR 0037) and rate limits.
- In the `toheplay.io.vn` zone the owner adds `games`, `docs` and `www` — proxied, to production's IP like the root
  already is — the `www` redirect, and `_dmarc`. `platform-infra`'s `apps/tohe` follows.
- The self-hosting guide and the chart now ask for a domain Tò He has to itself, and a domain of its own for the games
  only where Tò He must share one.
- Local development and UAT are unchanged.

## Alternatives considered

- **The hub and the site on `toheplay.io.vn`, the games on a second domain** — ADR 0039's shape, moved. The games
  apart from everything, and the hub's zone free to challenge bots; one more domain and zone. The owner chose one
  domain.
- **Keep the hub and the site on `vinetic.io.vn`** (ADR 0039). Tò He would stay tied to a domain it shares with apps
  that are not its own.
- **The site at the root, the hub at `app.toheplay.io.vn`.** The hub is where people go — invitations, tables, the
  installed app — so it takes the shortest name; the site is the introduction and the docs.
