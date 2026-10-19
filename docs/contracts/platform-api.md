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
| Errors | RFC 9457 problem details (`application/problem+json`) with a machine-readable `code`; validation errors carry codes per field. |
| Description | OpenAPI 3.1, generated at build time to [`services/api/openapi/tohe-api.json`](../../services/api/openapi/tohe-api.json) and committed. |
| Clients | The hub's types are generated from that file (`pnpm --filter @tohe/hub generate:api`). Never hand-write request/response types. |
| Auth | Cookie session `tohe.session` on the hub origin (`__Host-tohe.session` when the hub is served over HTTPS — [ADR 0021](../decisions/0021-release-production-through-the-tohe-chart.md)); account and profile management behind the parent gate. See [Identity](../architecture/identity.md) and [ADR 0011](../decisions/0011-password-sign-in-first.md). |
| Health | `GET /api/health` → `Healthy` when the database is reachable. |
| Telemetry | `POST /api/telemetry` is anonymous (the hub's batches, ADR 0015); `GET /api/telemetry/report` needs the operator token in `X-Tohe-Operator`. See [Device telemetry](../architecture/telemetry.md). |
| Interactive docs | `GET /api/docs` (Scalar) on a running API where `Api:Reference:Enabled` is on: `pnpm dev` and compose, not UAT or production ([Configuration](../guides/configuration.md#api)). |

## Changing the API

1. Change the endpoint in its module (`Modules/<Name>/`), with a test in `tests/Tohe.Api.Tests`.
2. `pnpm --filter @tohe/api build` regenerates `openapi/tohe-api.json`.
3. `pnpm --filter @tohe/hub generate:api` regenerates the hub's types; fix the hub until `pnpm typecheck` passes.
4. Commit all three together. CI fails if any generated file is stale.

Breaking an endpoint the deployed hub uses is not allowed while an old hub may still be cached on phones: add the
new shape next to the old one, ship the hub, then remove the old shape.

## Reference

The generated reference lives at [Platform API (generated)](/reference/api/).
