---
title: "0007: Immutable versioned game builds + a catalog indexed by the API"
description: Games publish static builds under /<id>/<version>/; the API learns about them from catalog.json.
sidebar:
  order: 7
---

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Games are static files. The hub needs a list of playable games with metadata, the API needs to know games exist
(saves and scores reference them), and old builds may still be open on someone's phone during an update.

## Decision

- `tools/games-host` (`pnpm build`) copies each `games/<id>/dist` to `.out/games/<id>/<version>/` and writes
  `.out/games/catalog.json` (schema in `@tohe/contract`). Builds are **immutable**: a change requires a new version.
- The games origin serves builds with `Cache-Control: immutable` and `catalog.json` with `no-cache`.
- The API's Registry module polls `catalog.json` (`Registry:SyncInterval`) and upserts its `registry.games` table.
  Games missing from the catalog are **unlisted, never deleted**, so their saves and scores stay valid.
- The hub lists games from `GET /api/games`, which returns absolute `entryUrl`s on the games origin.
- One version per game is current. Old versions remain on disk until a cleanup policy is decided.

## Consequences

- Rollback = rebuild the previous version; no cache invalidation is ever needed.
- The catalog is pull-based: a new game appears in the hub within one sync interval.
- A future "beta" channel can be added as a catalog field without changing the flow.

## Alternatives considered

- **Push registration (CI calls an admin endpoint):** needs admin credentials in CI and an auth flow before M1.
- **Hub reads catalog.json directly:** skips the API, but the API must know games for saves, scores and
  per-profile visibility anyway.
