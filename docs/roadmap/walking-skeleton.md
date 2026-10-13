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
| M1 | Identity & households | *Done:* username + password sign-in (ADR 0011), households with invites, child profiles with avatar/age band/PIN, parent gate, profile picker, age-filtered catalog, guest progress moved. See [Identity](../architecture/identity.md). |
| M2 | Saves & scores sync | API stores saves/scores per profile; hub syncs in the background; household leaderboard per game; conflict policy from ADR 0005. |
| M3 | First real game: Merge Block | *Done:* "Ghép Khối" on Phaser 4 + `@tohe/game-kit` after the [technology research](../research/game-tech.md) (ADR 0012); pure logic with a random-play bot, saves after every move, tiered juice, Canvas fallback. |
| M4 | UAT on the homelab | *Done (ADR 0010):* `compose.uat.yaml` + `deploy/uat/deploy.sh` on 10.100.0.2, backups before every deploy. See [UAT environment](../guides/uat.md). |
| M5 | Light & dark themes | *Done (ADR 0013):* design tokens; *Theo máy / Sáng / Tối* per device, shared by the hub, the landing page and the docs; games opt in with `themes` + `settings.theme` (Ghép Khối and Chạm Chấm do); contrast checked in both themes by tests, e2e and conformance. See [Theming](../architecture/theming.md). |
| Later | Production | Only when needed: HTTPS, public hostnames, off-machine backups — new ADR. |
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

- Accounts exist (M1); "Chơi thử" still keeps a local guest profile per device.
- Saves and scores stay on the device (M2).
- No production deployment yet; UAT runs on the homelab (ADR 0010).
- No games-origin service worker (S1).
- SDK reference is hand-written; no TypeDoc (ADR 0008).
- Some dependency upgrades are on hold; see the [upgrade watchlist](upgrade-watchlist.md).
