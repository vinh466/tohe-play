---
title: "0008: Technology baseline"
description: The approved stack, the versions it started with, and the deliberate exclusions.
sidebar:
  order: 8
---

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

The owner approved a stack on 2026-10-13 before the repository was created. This ADR records it so that agents do
not introduce alternatives casually. Versions are those resolved at initialisation; Dependabot moves them forward.

## Decision

| Area | Choice |
| --- | --- |
| Runtime / tooling | Node 24 LTS, pnpm 11 (workspaces, one-day minimum release age), Turborepo 2, Biome 2 |
| TypeScript | **TypeScript 7** (native compiler) for `tsc --noEmit` everywhere. Tools that need the classic compiler API run in isolated packages with their own TypeScript: `tools/codegen` (openapi-typescript, TS 5.9). |
| Contract | Zod 4 schemas → JSON Schema; dependency-free game SDK (ESM + IIFE) |
| Hub | React 19, Vite 8, TanStack Router + Query, Tailwind CSS 4, vite-plugin-pwa (Workbox), Dexie 4, i18next, openapi-fetch |
| Games (menu) | TS + Canvas 2D (default), DOM/React, Phaser 4, PixiJS 8, Godot 4 web export; Vitest + fast-check for logic |
| Site | Astro 7 + Starlight, astro-mermaid, starlight-openapi, starlight-llms-txt, starlight-links-validator |
| Backend | .NET 10, ASP.NET Core Minimal APIs, EF Core 10 + Npgsql, PostgreSQL 18, Scalar, xUnit v3 + Testcontainers |
| Quality | Playwright (conformance kit, e2e smoke), GitHub Actions |
| Runtime images | Caddy 2 (static + proxy), chiseled .NET images |
| Deployment (planned) | k3s homelab, Cloudflare, Infisical for secrets, kube-prometheus-stack for metrics |

**Deliberately not used:** Next.js/SSR (the hub is a SPA), microservices, MediatR (commercial licence), Redis and
message queues (no need at this scale), Unity WebGL (too heavy for phones), ESLint + Prettier (Biome), .NET Aspire
(compose is simpler for agents), shadcn/ui components until a screen needs them.

## Consequences

- A new framework, database, or service requires a new ADR.
- TypeScript 7 lacks the JS compiler API; generators needing it stay isolated (pattern: `tools/codegen`).
  TypeDoc is postponed for the same reason.
- The pnpm release-age policy occasionally means using the second-newest version of a package. That is intended.

## Alternatives considered

Recorded in the conversation that approved the stack; the main ones are in ADRs 0001–0003.
