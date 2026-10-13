---
title: "0002: Games run in a sandboxed iframe on their own origin"
description: Games are embedded cross-origin and talk to the hub only through a validated postMessage protocol.
sidebar:
  order: 2
---

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Games should be free to use any web technology, and many will be written by AI agents. A buggy or careless game
must not be able to read the player's session, call the API as the player, break the hub, or phone home.

## Decision

- Games are served from a **separate origin** (local `:4730`, production `tohe-games.vinetic.io.vn`) and embedded
  with `<iframe sandbox="allow-scripts allow-same-origin">`. `allow-same-origin` applies to the games origin, so
  games can load their own assets and WebAssembly; they still cannot touch the hub's origin.
- Games are served with a strict CSP generated from `@tohe/contract` (`connect-src 'self'`, no inline scripts,
  `frame-ancestors` = the hub). The conformance kit tests every game under that exact CSP.
- The hub and game talk only through `postMessage` with the Game Contract protocol. The hub checks
  `event.source` and `event.origin` and validates every message with Zod. The game learns the hub's origin from
  `init` and replies only to it.
- Games never call the API. The hub does it on their behalf, with the player's session.
- Production hostnames are flat (`tohe-*.vinetic.io.vn`) because Cloudflare's free certificate covers one
  subdomain level.

## Consequences

- Tokens and cookies are out of reach of game code by construction.
- Games cannot persist anything themselves (third-party storage in iframes is partitioned or cleared anyway);
  everything goes through `save()`.
- Offline support for the games origin needs its own service worker — tracked as spike S1.
- iOS audio unlock inside a cross-origin iframe needs a user gesture in the iframe — tracked as spike S2.

## Alternatives considered

- **Same-origin iframe with `sandbox` without `allow-same-origin`:** the game becomes an opaque origin and cannot
  fetch its own assets without CORS; breaks engines like Godot.
- **Games bundled into the hub:** no isolation, one technology, one release train.
- **Web Components / Module Federation:** shares the hub's origin and JavaScript realm; no security boundary.
