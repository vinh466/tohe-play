# Tò He — instructions for agents

Tò He is a self-hosted web/PWA platform for small casual games, built for a family and designed so that AI
agents can add games quickly on a stable foundation. **`docs/` is the specification.** Read
[`docs/guides/working-with-agents.md`](docs/guides/working-with-agents.md) before changing anything.

## Map

| Path | What |
| --- | --- |
| `docs/` | Spec: overview, architecture, contracts, guides, conventions, ADRs, roadmap |
| `packages/contract` | Game Contract v1 (Zod) — source of truth for game.json, catalog, protocol, CSP |
| `packages/game-sdk` | Game side (no runtime deps) and host side (`/host`) of the contract |
| `packages/game-kit` | Phaser setup, sounds, haptics, juice, overlay screens — use it for every new game (ADR 0012) |
| `games/<id>` | One game per folder; `games/merge-block` is the reference for real games, `games/hello` the minimal one |
| `apps/hub` | React PWA: catalog, launcher, local-first storage |
| `apps/site` | Landing (vi) + docs site (en) |
| `services/api` | .NET 10 modular monolith + PostgreSQL |
| `tools/` | conformance kit, games-host, e2e smoke, codegen |

## Rules that are easy to break

- Spec first; decisions that are expensive to reverse get an ADR (`docs/decisions/`, skill `/new-adr`).
- Changing `packages/contract` changes the Game Contract: ADR + docs + conformance in the same PR.
- Games never call the API, never use their own storage, never make network requests outside their folder.
- Never edit generated files (`packages/contract/schema/`, `services/api/openapi/`, `apps/hub/src/api/schema.gen.ts`);
  regenerate them.
- Never weaken a check (tests, conformance, CSP, pnpm's minimum release age) to make it pass.
- Develop only on the dev stack: ports 47xx, compose project `tohe`. Never touch other databases or containers.
- UAT (`tohe-uat`, ports 48xx, 10.100.0.2) holds the family's data: deploy only with `deploy/uat/deploy.sh`,
  never wipe its volume or run migrations against it by hand (docs/guides/uat.md).
- Before merging a dependency upgrade, check `docs/roadmap/upgrade-watchlist.md`. Dependabot PRs listed there
  stay open on purpose as reminders — do not close them or add ignore rules for them.

## Commands

```sh
pnpm install && dotnet tool restore
docker compose up -d postgres && pnpm dev      # hub http://localhost:4720
pnpm verify                                    # Definition of Done, run before every PR
pnpm --filter @tohe/e2e smoke                  # against a running stack
```

Skills: `/new-game`, `/new-adr`, `/verify` (in `.claude/skills/`).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
