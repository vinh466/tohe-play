---
title: Architecture decisions
description: Why things are the way they are. Accepted decisions are binding until superseded.
sidebar:
  order: 0
  label: Index
---

An Architecture Decision Record (ADR) captures one decision that is expensive to reverse: its context, the
choice, and the consequences. ADRs are never edited after acceptance except to mark them **Superseded by NNNN**;
a changed mind is a new ADR.

Create one with `/new-adr` or by copying [the template](0000-template.md) to the next free number.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-monorepo-with-independent-games.md) | One monorepo; games independent through a contract | Accepted |
| [0002](0002-games-in-sandboxed-iframe-on-own-origin.md) | Games run in a sandboxed iframe on their own origin | Accepted |
| [0003](0003-backend-dotnet-modular-monolith-postgres.md) | Backend: .NET 10 modular monolith + PostgreSQL | Accepted |
| [0004](0004-identity-households-and-profiles.md) | Identity: households, adult accounts and child profiles | Accepted (built in M1) |
| [0005](0005-offline-first.md) | Offline first: games keep working without the API | Accepted |
| [0006](0006-docs-as-code.md) | Docs as code, rendered by Starlight, written for humans and agents | Accepted |
| [0007](0007-immutable-game-builds-and-catalog.md) | Immutable versioned game builds + a catalog indexed by the API | Accepted |
| [0008](0008-technology-baseline.md) | Technology baseline | Accepted |
| [0009](0009-local-environment.md) | Local environment: 47xx ports, compose, isolation | Accepted |
| [0010](0010-environments-dev-and-uat.md) | Environments: development and UAT on the homelab | Accepted |
