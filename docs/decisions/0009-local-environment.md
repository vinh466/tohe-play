---
title: "0009: Local environment: 47xx ports, compose, isolation"
description: Fixed local ports, two run modes, and strict isolation from other stacks on the machine.
sidebar:
  order: 9
---

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

The development machine also runs other projects (their own PostgreSQL on 5432, gateways on 5000–5400 and
8080–8092, monitoring on 3030/9090). Agents and humans need one predictable way to run Tò He without touching
anything else, and a production-like mode to test images before deploying.

## Decision

- Fixed ports: site 4710, hub 4720, games 4730, single-game dev 4731, API 4740, PostgreSQL 4750 (loopback only).
- Compose project name `tohe`; its own PostgreSQL container and volume. Nothing in this repository connects to
  databases or containers outside that project. Tests use Testcontainers.
- Two modes: **A** `docker compose up -d postgres` + `pnpm dev` (hot reload) and **B** `docker compose up --build`
  (production images). They are mutually exclusive.
- `TOHE_PUBLIC_HOST` switches mode B to a LAN address for testing on phones.
- Development credentials (`tohe` / `tohe-dev-only`) are for local containers only; real secrets live in Infisical.

## Consequences

- Port conflicts with other projects are avoided by construction.
- Mode B doubles as the deployment rehearsal: the same Dockerfiles and Caddyfiles go to production.

## Alternatives considered

- **Random ports per run:** no collisions, but breaks bookmarks, docs and the origin configuration.
- **Reusing the machine's existing PostgreSQL:** saves memory, violates isolation.
