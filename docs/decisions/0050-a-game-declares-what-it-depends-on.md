---
title: "0050: A game declares what it depends on; the platform provides it and keeps the guardrails"
description: Every way a game leans on the platform is a declaration in game.json, chosen from levels the platform offers; the platform provides each level, keeps guardrails no declaration can change, and checks in conformance exactly what the game declared.
sidebar:
  order: 50
---

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decided by:** the owner, 2026-10-22 (plans/asset-studio D-01: "nền tảng ta sẽ hỗ trợ và game sẽ tự quyết định mức độ
  phụ thuộc … đó là lựa chọn của game, game sẽ tự xử lý để đảm bảo vận hành của chính nó và nó contract rõ với nền tảng
  … có thể là cách tiếp cận này cho các vấn đề khác"; "ok chốt").

## Context

Games on Tò He differ more and more. A small one-player game is one folder that runs offline and needs nothing from the
platform but the protocol. A content-heavy game (the backlog's farm and RPG) wants pictures from a shared library,
perhaps loaded in parts, an account to keep progress on every device, a table to play at. One fixed rule for all of them
either weighs down the small ones or rules out the big ones.

The contract already works this way in places, without saying so:

- `capabilities` (`save`, `scores`, `rooms`, `shell`, `ranked`): a call the game did not declare is rejected.
- `identity` and `entries` ([ADR 0045](0045-games-declare-identity-and-entries.md)): the game says what opening it asks
  for and which links it opens; the hub does the rest.
- `orientation`, `themes`, `sizeBudgetKb`: the game says, conformance checks.

The owner asked for the pattern to be the rule, so that every new area — assets first
([ADR 0051](0051-an-asset-studio-for-game-assets.md)) — is designed the same way, and so the platform stays open to
different games without giving up what it promises players.

## Decision

### The rule

1. **A game's dependency on the platform is a declaration**, in `game.json` (or, for something that changes during
   play, a protocol request the game already declared it may make). Without a declaration a game depends on nothing
   beyond the protocol, which is how a game behaves today.
2. **The platform offers levels.** For each area it lists the levels a game may choose — from "none" up — and provides
   each one. A game picks the level that fits it and takes care of its own behaviour at that level (an online-only
   part shows what it does offline, for instance).
3. **The platform keeps guardrails.** For each area it states what no declaration changes. A level that would need a
   guardrail lowered is not offered.
4. **Conformance checks what was declared.** Each level has its check in the conformance kit; a game is tested at the
   levels it chose, not at all of them.
5. **A new area starts with an ADR** that lists its levels and its guardrails, before any game can choose.

### Guardrails that hold in every area

- The sandbox and the games' own origin ([ADR 0002](0002-games-in-sandboxed-iframe-on-own-origin.md),
  [ADR 0040](0040-all-of-tohe-on-one-domain-of-its-own.md)), and the CSP generated from the contract: no declaration
  widens them.
- A game reaches only its own build folder and, where an area allows it, Tò He's own origins — never an arbitrary
  address.
- A build is immutable ([ADR 0007](0007-immutable-game-builds-and-catalog.md)): what a game depends on is fixed when it
  is built.
- What the server referees (a table's rules, a ranked run's replay) depends only on what is in the build.
- No declaration gives a game another game's or another player's data.

### Areas that follow the rule

| Area | Declared in | Levels | Decided by |
| --- | --- | --- | --- |
| Platform services | `capabilities` | each of `save`, `scores`, `rooms`, `shell`, `ranked`, or none | Game Contract v1 |
| Who may open it | `identity.play`, `identity.rooms` | `any` · `named` · `account` | [ADR 0045](0045-games-declare-identity-and-entries.md) |
| Ways in | `entries` | none · `share` | [ADR 0045](0045-games-declare-identity-and-entries.md) |
| Screen | `orientation`, `themes` | `portrait` · `landscape` · `any`; `light` · `dark` | Game Contract v1, [ADR 0013](0013-light-and-dark-themes.md) |
| Size | `sizeBudgetKb` | up to 50 000 KB | Game Contract v1 |
| Assets | `assets` | none · per pack: `bundle` (later `precache`, `on-demand`) | [ADR 0051](0051-an-asset-studio-for-game-assets.md) |

### Not done here

- No new field in the contract: this ADR names the rule; each area's ADR changes the contract.
- No runtime negotiation beyond what an area allows (today only `identity.require` and `share`, ADR 0045).
- No per-game CSP.

## Consequences

- The [Game Contract](../contracts/game-contract-v1.md) says the rule once, before the manifest, and lists the areas.
- Every new area (assets now, others later — agents that help run the platform are one the owner named) brings an ADR
  with its table of levels and its guardrails, and conformance checks for each level.
- Reviews of a new game look at its declarations first: they say what it needs from the platform.

## Alternatives considered

- **One way for every game** (everything bundled, everything online, or one fixed set of services): simple to test,
  but it either weighs down the small games or rules out the large ones.
- **No rule; each area decides on its own**: what happens today. It works while one person designs every area, but the
  areas drift apart, and an agent adding a game has to learn each one's logic separately.
