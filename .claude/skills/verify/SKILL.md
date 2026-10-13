---
name: verify
description: Run the Tò He Definition of Done locally — lint, typecheck, tests (incl. API tests on PostgreSQL), builds, conformance, generated-file drift, and optionally the e2e smoke test — and report results. Use before opening or merging a PR.
---

# Verify

Run from the repository root and report each step's result with the relevant output on failure.

1. `pnpm install --frozen-lockfile`
2. `pnpm verify` — Biome, typecheck, unit tests, API tests (needs Docker), builds, conformance.
3. Generated files are current:
   ```sh
   pnpm --filter @tohe/hub generate:api
   git status --porcelain
   ```
   Any change under `packages/contract/schema/`, `services/api/openapi/` or `apps/hub/src/api/` means a stale
   generated file — commit the regenerated version.
4. If the hub, the API or a game's runtime behaviour changed: start the stack (`docker compose up -d postgres` and
   `pnpm dev`, or `docker compose up --build -d`) and run `pnpm --filter @tohe/e2e smoke`.
5. Walk through `docs/conventions/definition-of-done.md` and state which items do not apply.

Never weaken a check to get green; report the failure instead.
