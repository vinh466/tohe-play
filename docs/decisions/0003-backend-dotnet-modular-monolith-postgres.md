---
title: "0003: Backend: .NET 10 modular monolith + PostgreSQL"
description: One ASP.NET Core service with module boundaries, one PostgreSQL database with a schema per module.
sidebar:
  order: 3
---

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

The platform needs a backend from day one (identity, saves, scores, registry) that one person can run for years
on a homelab. The owner works with .NET and PostgreSQL daily.

## Decision

- **ASP.NET Core 10 (LTS) Minimal APIs**, one deployable: `services/api/src/Tohe.Api`.
- **Modules** under `Modules/<Name>/` own their endpoints, services and tables. No cross-module table access;
  modules talk through C# interfaces when needed.
- **PostgreSQL 18**, EF Core 10 with Npgsql, snake_case names, one schema per module, migrations applied on start
  where configured (`Database:MigrateOnStartup`).
- **OpenAPI 3.1 generated at build time** and committed; clients are generated from it.
- Tests: xUnit v3 on Microsoft.Testing.Platform, `WebApplicationFactory` + Testcontainers (real PostgreSQL).
- Container: chiseled ASP.NET image, non-root.

## Consequences

- One process to deploy, monitor and back up. A module can be extracted later because its boundary is explicit.
- Cross-module features need deliberate interfaces instead of joins.
- The Docker image cannot load GSSAPI; connection strings set `GSS Encryption Mode=Disable`.

## Alternatives considered

- **Node.js (TypeScript) backend:** one language across the repo, but less familiar to the owner and weaker for
  long-term maintenance by them.
- **BaaS (PocketBase, Supabase):** fastest start, but the learning goal and long-term control favour owning the API.
- **Microservices:** operational cost without a matching benefit at this scale.
