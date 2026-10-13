---
title: "0012: Phaser 4 and the game kit are the default way to build games"
description: New games use Phaser 4 through @tohe/game-kit, with pure logic that emits events the view animates.
sidebar:
  order: 12
---

- **Status:** Accepted
- **Date:** 2026-10-13
- **Amends:** the "Games (menu)" line of [ADR 0008](0008-technology-baseline.md), whose default was TS + Canvas 2D

## Context

The owner asked for one stable, polished way of building games that also carries to block blast, tetris-likes,
mini farms and light RPGs. Research and measurements: [Game technology research](../research/game-tech.md).

## Decision

- **Phaser 4** is the default engine for new games. Canvas 2D stays acceptable for tiny games (like `hello`); Godot
  stays allowed for large ones; other engines need an ADR.
- Games use **`@tohe/game-kit`** for what every game must do the same way:
  - `createGame` — canvas at device pixels (crisp text on phones), resize/rotation, pause/resume, no Phaser audio;
    if WebGL fails while booting it restarts the game once with Phaser's Canvas renderer, so a broken GPU never
    leaves a child in front of a black screen;
  - `sfx` (synthesised Web Audio), `haptics`, `juice` (tiered feedback), `overlay` (shared look of menus), `format`.
- Every game is **logic + view**: `logic.ts` is pure and returns *events* (`land`, `merge`, `fall`…) with the new
  state; the view only animates events; all randomness lives in the state (seeded PRNG) so saves resume exactly and
  replays are deterministic; the random-play bot checks the SPEC's invariants.
- Size budget for a Phaser game: up to ~2.5 MB uncompressed (Phaser alone is ~1.4 MB, ~350 KB gzip). Sharing one
  Phaser copy between games on the games origin is a later optimisation.
- GSAP is not used (Phaser's tweens and timelines suffice; GSAP's licence is proprietary and amendable).

## Consequences

- Agents get one well-documented pattern (`games/merge-block` is the reference) and a kit that already handles the
  hard parts (DPR, audio unlock on iOS, WebGL fallback).
- Each Phaser game ships its own ~350 KB (gzip) engine until the shared-runtime optimisation exists; builds are
  cached for a year.
- Phaser 4 is six months old; the kit isolates games from most engine details, and Phaser 3 is API-compatible for
  everything the kit uses if a downgrade is ever needed.

## Alternatives considered

- **PixiJS 8 + GSAP + our own systems:** lighter and crisp by default, but tilemaps, cameras, sound, particles and
  scenes would be ours to assemble and maintain for farm/RPG genres; agents often write PixiJS v7 code.
- **Canvas 2D for everything:** every system (tweens, particles, scenes) would be ours to build.
- **Editor engines (Defold, Cocos Creator):** their own languages and editors; poor fit for agents in a TS monorepo.
