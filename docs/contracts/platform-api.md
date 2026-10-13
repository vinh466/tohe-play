---
title: Platform API
description: Conventions of the backend API used by the hub.
sidebar:
  order: 2
---

The Platform API (`services/api`) serves the hub. **Games never call it** — they use the
[Game Contract](game-contract-v1.md) and the hub calls the API on their behalf.

## Conventions

| Topic | Rule |
| --- | --- |
| Base path | Everything under `/api`. The hub reaches it on its own origin (Vite proxy in dev, Caddy in docker/prod). |
| Format | JSON, `camelCase`, numbers are numbers (`JsonNumberHandling.Strict`). |
| Errors | RFC 9457 problem details (`application/problem+json`). |
| Description | OpenAPI 3.1, generated at build time to [`services/api/openapi/tohe-api.json`](../../services/api/openapi/tohe-api.json) and committed. |
| Clients | The hub's types are generated from that file (`pnpm --filter @tohe/hub generate:api`). Never hand-write request/response types. |
| Auth | Cookie session on the hub origin (M1, [ADR 0004](../decisions/0004-identity-households-and-profiles.md)). |
| Health | `GET /api/health` → `Healthy` when the database is reachable. |
| Interactive docs | `GET /api/docs` (Scalar) on a running API. |

## Changing the API

1. Change the endpoint in its module (`Modules/<Name>/`), with a test in `tests/Tohe.Api.Tests`.
2. `pnpm --filter @tohe/api build` regenerates `openapi/tohe-api.json`.
3. `pnpm --filter @tohe/hub generate:api` regenerates the hub's types; fix the hub until `pnpm typecheck` passes.
4. Commit all three together. CI fails if any generated file is stale.

Breaking an endpoint the deployed hub uses is not allowed while an old hub may still be cached on phones: add the
new shape next to the old one, ship the hub, then remove the old shape.

## Reference

The generated reference lives at [Platform API (generated)](/docs/reference/api/).
