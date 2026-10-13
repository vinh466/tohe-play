---
title: Walking skeleton
description: Milestones from the initial skeleton to the go/no-go decision, plus the spikes that de-risk them.
sidebar:
  order: 1
---

A walking skeleton is the thinnest version of every part, working end to end, before any part gets deep. Each
milestone ends with something playable and a green `pnpm verify` + e2e smoke test.

## Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| **M0** | **Skeleton** *(this initial commit)* | Contract + SDK + conformance kit; sample game; API with registry; hub with catalog and launcher; local-first saves; site with docs and ADRs; compose stack; CI. |
| M1 | Identity & households | ADR 0004 implemented: adult sign-in (Google, passkey), households, child profiles with avatar/PIN, profile picker in the hub, guest data migrated. |
| M2 | Saves & scores sync | API stores saves/scores per profile; hub syncs in the background; household leaderboard per game; conflict policy from ADR 0005. |
| M3 | First real game: Merge Block | Spec → game built mostly by an agent with `/new-game`; a grid kit extracted only if a second grid game needs it. |
| M4 | Production | Images published by CI, deployed to the homelab (k3s) behind Cloudflare, secrets in Infisical, metrics in kube-prometheus-stack, backups for PostgreSQL. |
| Gate | Go / no-go | The criteria in [Vision & scope](../vision.md#go--no-go). |

## Spikes

Short, throw-away experiments that answer one risky question each; results go into an ADR or the docs.

| # | Question | Why it matters |
| --- | --- | --- |
| S1 | Can a cross-origin game iframe be fully offline via its own service worker, on iOS Safari and in an installed PWA? | Offline promise (ADR 0005). |
| S2 | How does audio unlock behave inside a cross-origin iframe on iOS? | Sound in games. |
| S3 | Fullscreen, orientation lock and safe-area insets inside the iframe on iOS and Android. | Layout of every game. |
| S4 | Size and start-up time of a Godot 4 single-threaded web export inside the iframe. | Validates the "any technology" promise. |

## Known gaps in M0

- One local guest profile per device; no accounts yet (M1).
- Saves and scores stay on the device (M2).
- No production deployment or published images yet (M4).
- No games-origin service worker (S1).
- SDK reference is hand-written; no TypeDoc (ADR 0008).
- Some dependency upgrades are on hold; see the [upgrade watchlist](upgrade-watchlist.md).
