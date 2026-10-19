---
title: "0039: Serve games from a registrable domain of their own"
description: In production the games origin is toheplay.io.vn, a site of its own rather than a sibling subdomain of the hub's vinetic.io.vn, so game code can neither set cookies nor send same-site requests to any app of that domain; the origin's front page leads to the hub and search engines leave it out; nothing in the code names it.
sidebar:
  order: 39
---

- **Status:** Accepted — all of Tò He on `toheplay.io.vn`, the games origin at `games.toheplay.io.vn`, since
  [ADR 0040](0040-all-of-tohe-on-one-domain-of-its-own.md)
- **Date:** 2026-10-18
- **Amends:** [ADR 0002](0002-games-in-sandboxed-iframe-on-own-origin.md) — the production games origin is
  `https://toheplay.io.vn`, not `tohe-games.vinetic.io.vn`

## Context

ADR 0002 gave games an origin of their own — `tohe-games.vinetic.io.vn` in production — and a sandboxed iframe that
cannot reach the hub's cookies, storage or API. Browsers draw a second line, though: the *site*, the registrable
domain found with the Public Suffix List. `io.vn` is on that list, so `vinetic.io.vn` is one site, and every host under
it is same-site with every other: Tò He's `tohe`, `tohe-games` and `tohe-site`, and apps that are not Tò He's —
`platform`, `platform-dev`, `auth`, `wiki`, `storybook` (`platform-infra`, 2026-10-18).

Same-site is not a security boundary. A page on any of those hosts can set a cookie with `Domain=vinetic.io.vn` that
all of them receive (cookie tossing), and its requests to them are same-site, so their `SameSite=Lax` and `Strict`
cookies go along. Tò He protects itself already: on HTTPS its session cookie is `__Host-tohe.session`, which no other
host can set or shadow (ADR 0021), and the API refuses state-changing requests whose `Sec-Fetch-Site` is not
`same-origin` (ADR 0011). The other apps are not Tò He's to check — and game code, possibly AI-written and with
dependencies of its own, runs on the games origin. A game page opened in a tab of its own runs without the hub's
sandbox, with only its CSP, which does not restrict where a form may be sent.

A site also shares its reputation: a blocklist that flags one host can flag the whole registrable domain, and with it
the hub, the other apps and the domain email is sent from.

The owner decided D-13 on 2026-10-18 ("chắc tôi sẽ mua 1 domain mới") and bought `toheplay.io.vn`.

## Decision

- **In production the games origin is `https://toheplay.io.vn`**: the domain itself, on a Cloudflare zone of its own,
  serving nothing but game builds and `catalog.json`. The hub (`tohe.vinetic.io.vn`) and the site stay where they are.
  As a different site from `vinetic.io.vn`, game code can neither set a cookie any app there receives nor send them a
  request that carries their cookies.
- **Nothing in the code names it.** The chart's `publicUrls.games` gives the hub's CSP (`frame-src`, `img-src`), the
  console's `frame-src`, the API's `Games:PublicOrigin` — from which the hub and the console learn whose messages to
  trust — and the Ingress host; `publicUrls.hub` gives the games' `frame-ancestors`. The production shape,
  `deploy/helm/tohe/ci/platform-infra.yaml`, names it.
- **The origin's front page leads to the hub.** `toheplay.io.vn` is a name people may type: `/` answers `302` to the
  hub (`PUBLIC_HUB_URL`), uncached, instead of an empty `404`. The local games server does the same, and the e2e smoke
  test checks it.
- **Search engines leave the games origin out**: every response carries `X-Robots-Tag: noindex, nofollow` — a game
  page is meant only inside the hub's frame.
- **The defences for a same-site games origin stay.** The `__Host-` cookie and the `Sec-Fetch-Site` check cover local
  development and UAT, where only the port differs, and a self-hoster who puts games on a sibling subdomain. The chart
  and the self-hosting guide recommend a domain of its own.
- **Not done here:** `form-action` in the games' CSP — on a site of its own, a form a game page sends no longer
  carries the cookies of `vinetic.io.vn`'s apps; the Cloudflare zone and the `platform-infra` side (DNS record,
  Ingress) — the owner's and A4's, with the zone's settings listed in the [self-hosting guide](../guides/self-hosting.md).

## Consequences

- The owner points `toheplay.io.vn` at Cloudflare and gives the zone the SSL/TLS mode of `vinetic.io.vn`'s (TLS ends
  at Cloudflare; Traefik behind it serves HTTP). The DNS record and the Ingress come with A4 in `platform-infra`.
- What would break games framed by another site stays off on that zone: bot challenges (Bot Fight Mode, "I'm Under
  Attack", WAF challenges — their cookie is a third-party cookie inside the hub's frame, which Safari and Firefox
  block), Hotlink Protection (the hub loads game icons from the games origin, with the hub as referrer), and whatever
  rewrites pages or adds scripts a game does not ship — Rocket Loader, injected Web Analytics.
- A second domain to renew every year, with a reputation of its own from zero: some DNS filters block domains younger
  than about 30 days, so it was bought well before launch.
- Framed by another site, the games origin's storage is partitioned under the hub's site. Games keep nothing there
  (ADR 0002), so nothing changes; offline play (spike S1) and iOS audio (spike S2) are tried again on the new domain
  before launch.
- Changing the games origin of a running deployment is not instant: installed hubs serve the page their service worker
  cached, whose CSP names the old origin, until it takes a newer hub build. Production starts on `toheplay.io.vn` and
  never meets this.
- Local development and UAT are unchanged.

## Alternatives considered

- **Keep `tohe-games.vinetic.io.vn`.** Free, and Tò He itself is covered; the other apps on the domain are not, and
  they share Tò He's reputation.
- **Move all of Tò He to a domain of its own**, hub and site too. The games origin would then need yet another domain
  to stay a different site from the hub; the sender address, the OAuth redirect URIs and the links people shared would
  move with it. Worth it only for a brand of its own.
- **A subdomain of the new domain** (`play.toheplay.io.vn`) rather than the domain itself. Nothing else is meant to live
  on `toheplay.io.vn`, so the shorter address costs nothing; Cloudflare's free certificate covers both.
