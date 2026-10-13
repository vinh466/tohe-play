---
title: Vision & scope
description: Who Tò He is for, what it must be good at, and what it deliberately is not.
---

## Why

Casual mini-game portals are full of ads and interruptions. Tò He is a calm alternative for one household: a
handful of small games, no ads, no tracking, playable in a phone browser in seconds — and a learning project
for building a durable technical foundation.

The name comes from *tò he*, the Vietnamese children's toy figurines made of coloured rice dough: small, bright
and shaped quickly. Each game here is one such figurine, shaped quickly from the same dough.

## Who it is for

| Who | Needs |
| --- | --- |
| The owner (developer) | A foundation that stays stable for years; games that can be added fast, often with AI help; a codebase that is pleasant to review. |
| Family members, including young children | Open and play in seconds; big touch targets; little text; pick a profile by avatar; no ads, chat or links out. |
| Friends | Same as family, invited by the owner. |
| A future developer or AI agent | Docs that explain intent, contracts that are checked by machines, one obvious way to do things. |

A public community is explicitly **not** a goal for now; if the platform proves itself over years, that can
be reconsidered with a new ADR.

## What it must be good at

1. **Instant play on a phone** — first game visible within a few seconds; installable as a PWA; playable offline
   after the first visit.
2. **Many small games, one place** — a shared catalog, profiles, saves and scores across all games.
3. **Fast, reliable game creation** — a new game from a one-paragraph idea to "playable on a phone" in an
   afternoon, with most of the work done by an AI agent following these docs and passing the automated checks.
4. **Technology freedom per game** — Canvas, DOM, Phaser, PixiJS, Godot web exports… as long as the game honours
   the [Game Contract](contracts/game-contract-v1.md).

## Non-goals

- Ads, in-app purchases, monetisation of any kind.
- Anti-cheat beyond what deterministic replays give for free.
- Chat, social feeds, user-generated content, public leaderboards.
- Real-time multiplayer (may become an ADR later; not designed for now).
- Native apps or app-store distribution.
- Scale beyond a few dozen players.

## Go / no-go

The project continues past the [walking skeleton](roadmap/walking-skeleton.md) only if all of these hold:

- A child in the family plays a real game on a real phone, with a profile, synced saves, and it still works with
  the API turned off.
- An AI agent builds a second game from these docs alone and it passes conformance with little help.
- The owner reads these docs and finds that they describe the intended design.
- Maintaining it still feels like fun, not a chore.
