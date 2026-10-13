---
title: Code conventions
description: Style, naming, git and review conventions for TypeScript and C#.
sidebar:
  order: 2
---

## General

- Write code that reads like the code around it. Comments explain **why**, not what.
- English in code, comments, commits and docs. Vietnamese in user-facing strings (with English as the second locale).
- No dead code, no commented-out code, no TODOs without an issue.

## TypeScript

- Strict TypeScript (`tsconfig.base.json`); `noUncheckedIndexedAccess` on. No `any`; prefer `unknown` + narrowing.
- ES modules with explicit `.ts` extensions in relative imports (Node 24 runs them directly).
- Formatting and linting: Biome (`pnpm format`). Single quotes, semicolons, 2 spaces, 110 columns.
- Validate data crossing a trust boundary with Zod schemas from `@tohe/contract`; trust nothing from an iframe.
- React: function components, TanStack Query for server state, no global state library until one is needed.

## C\#

- .NET 10, nullable enabled, warnings are errors, analyzers on (`Directory.Build.props`).
- Minimal APIs grouped per module: `Modules/<Name>/<Name>Module.cs` with `Add<Name>Module` and `Map<Name>Endpoints`.
- Package versions only in `Directory.Packages.props`.
- Logging with `[LoggerMessage]` source generators.
- EF Core: one `DbContext`, configurations per entity (`IEntityTypeConfiguration`), one PostgreSQL schema per module,
  snake_case names.
- Tests: xUnit v3, `ApiFactory` (WebApplicationFactory + Testcontainers). Test names read as sentences.

## Git

- Branch from `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- [Conventional Commits](https://www.conventionalcommits.org/): `feat(hub): …`, `fix(api): …`, `docs(adr): …`.
- Pull requests are small, describe the why, and link the docs/ADR they implement. Merge commits, no squash —
  history shows how a feature was built.

## Dependencies

- pnpm enforces a minimum release age of one day for npm packages. Do not add exclusions; pick an older version.
- New runtime dependencies in a game or the SDK need a reason in the PR; new technologies need an ADR.
- Dependabot keeps versions fresh; its PRs follow the same Definition of Done.
