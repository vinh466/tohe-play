---
title: "0001: One monorepo; games independent through a contract"
description: Platform and games live in one repository, but games are coupled to the platform only by the Game Contract.
sidebar:
  order: 1
---

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

The platform has several parts (site, hub, API, SDK, tools) and will host many small games, each possibly written
with different technology. One person maintains it, mostly with AI agents. Agents work best when everything they
need is in one place with one way to build and test it.

## Decision

- One repository, `vinh466/tohe-play`, managed by pnpm workspaces + Turborepo, with the .NET solution wrapped as a
  workspace package (`@tohe/api`) so `pnpm build|test|dev` covers everything.
- Games live in `games/<id>/`, each with its own toolchain. The **only** coupling between a game and the platform
  is the [Game Contract](../contracts/game-contract-v1.md): a `game.json` and the postMessage protocol, enforced
  by the conformance kit.
- Internal TypeScript packages export source; there is no build step between them.

## Consequences

- One `pnpm verify` checks the whole system; agents and CI run the same thing.
- A game can move to its own repository later without code changes — only its build output matters.
- The repository grows with every game; Turborepo caching keeps builds proportional to what changed.

## Alternatives considered

- **Polyrepo (platform + one repo per game):** cleaner ownership, but versioning the SDK across repos and giving
  agents context becomes the main cost. Not worth it for one maintainer.
- **Games as modules of the hub:** simplest at first, but forces one technology and lets game bugs break the hub.
