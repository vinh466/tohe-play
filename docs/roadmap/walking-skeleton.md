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
| M2 | Saves & scores sync | *Done:* the API stores saves and scores per profile; the hub syncs in the background and pulls before a game starts, so a child continues on another device; household leaderboard per game (🏆 on catalog cards); conflict policy from ADR 0005. See [Saves, scores and sync](../architecture/progress-sync.md). |
| M3 | First real game: Merge Block | *Done:* "Ghép Khối" on Phaser 4 + `@tohe/game-kit` after the [technology research](../research/game-tech.md) (ADR 0012); pure logic with a random-play bot, saves after every move, tiered juice, Canvas fallback. |
| M4 | UAT on the homelab | *Done (ADR 0010):* `compose.uat.yaml` + `deploy/uat/deploy.sh` on 10.100.0.2, backups before every deploy. See [UAT environment](../guides/uat.md). |
| M5 | Light & dark themes | *Done (ADR 0013):* design tokens; *Theo máy / Sáng / Tối* per device, shared by the hub, the landing page and the docs; games opt in with `themes` + `settings.theme` (Ghép Khối and Chạm Chấm do); contrast checked in both themes by tests, e2e and conformance. See [Theming](../architecture/theming.md). |
| M6 | Second real game | *Done:* "Chạm Ghép" (`tap-merge`), the owner's tap-to-merge variant of Ghép Khối, built from the kit in a day: continue / new game, live leaderboard (ADR 0014), drawn textures, light and dark. Next: Lấp Ô ([backlog](game-backlog.md)). |
| M7 | Device telemetry | *Done (ADR 0015), phases 1–2:* errors, frame times, load times and compatibility from players' devices, technical data only, three switches and a transparency page; a report agents read with `/health-report`. Next: browser crash and CSP reports. See [Device telemetry](../architecture/telemetry.md). |
| M8 | Online rooms + Tiến lên | *Done (ADR 0016, 0017), phases 1–3:* Tiến Lên against bots (0.1), then online tables (0.2): lobby, quick play, private rooms, 6-digit codes, `/r/<code>` links kept through sign-in, QR and sharing, bots for empty seats and lost connections, turn timer, reconnection and rebuilds after a restart, score sheet, preset reactions, the parent switch; refereed by the game's own rules module in Jint. Then (0.3) personal statistics and the household's board, the last hands and their replays, spectators, invitations to the family, telemetry counts. Next: spike S5 on iPhones. See [Online rooms](../architecture/rooms.md). |
| M9 | Game shell | *Done (ADR 0018):* every game opens on its own main menu (play or continue, settings, leaderboard, how to play, back to Tò He) and has one ☰ menu while playing that pauses what can pause; phone Back steps through it; rules fixed during a game, looks any time; the hub's bar over games is gone, with a safety net. Built once in the kit (`createShell`). Then (ADR 0019) a title screen with picture tools, a new game in the menu, the menu when the hub hides a game, the how-to before a first game, 3-2-1 for timed games, the kit's HUD, the hub's loading screen until a game's first screen, and leaving a screen going back in the history. Then (ADR 0020) two stages: the menu stage on its own with no engine, the play stage loaded in the background, created on play and freed on the way back, and a quick panel over play with in-place rows and no way out to Tò He; Chạm Chấm 1.4, Ghép Khối 1.8, Chạm Ghép 0.8, Tiến Lên 0.6. See [Game shell](../architecture/game-shell.md). |
| M10 | Public-launch foundations | *Done (ADR 0022–0038):* transactional email through an outbox (0022), accounts own their profiles (0023), email sign-in with a code (0024) and Google, GitHub or OpenID Connect providers built (0026), step-up and consent at sign-up (0025), the admin console and its first owner (0027), sign-in and registration switches at run time (0028), the integrity engine with trust levels and ranked runs replayed by the server (0029, 0030), review of held results (0031) and watching a run (0032), invitations by profile ID (0033), deleting profiles and accounts for good (0034, 0038), the name filter (0035), metrics for Prometheus (0036), proof-of-work before a code by email (0037). |
| M11 | Production | *Done (ADR 0021, 0039, 0040, 0041):* production on `toheplay.io.vn` through the `tohe` chart on the `platform-infra` cluster; the games on `games.toheplay.io.vn`, the docs on `docs.toheplay.io.vn`; one build promoted by tag, a `uat-` tag then a `prod-` tag. See [Environments and releases](../guides/environments.md). |
| Next | Product surface | *In progress:* a layout standard, public pages, the newcomer's journey, identity levels and entry links. |
| Gate | Go / no-go | The criteria in [Vision & scope](../vision.md#go--no-go). |

## Spikes

Short, throw-away experiments that answer one risky question each; results go into an ADR or the docs.

| # | Question | Why it matters |
| --- | --- | --- |
| S1 | Can a cross-origin game iframe be fully offline via its own service worker, on iOS Safari and in an installed PWA? | Offline promise (ADR 0005). |
| S2 | How does audio unlock behave inside a cross-origin iframe on iOS? | Sound in games. |
| S3 | Fullscreen, orientation lock and safe-area insets inside the iframe on iOS and Android. | Layout of every game. |
| S4 | Size and start-up time of a Godot 4 single-threaded web export inside the iframe. | Validates the "any technology" promise. |
| S5 | SignalR through the hub into the game iframe on iPhone Safari and the installed PWA: locked screen, network change, a call; reconnect, resync, CSP for the same-origin WebSocket. | Online rooms (ADR 0016). |
| S6 | Build a game's `rules.ts` into one ES module, run it in Jint, map stack traces back to TypeScript. | *Done in M8:* a second Vite build writes `dist/rules.js` and the API runs it ([research](../research/online-rooms.md)). Errors still name the minified module's positions; source maps for them are a later nicety. |

## Known gaps in M0

- Accounts exist (M1); "Chơi thử" still keeps a local guest profile per device.
- Guests' saves and scores stay on the device (by design); a replaced save can only be restored by hand.
- No games-origin service worker (S1).
- SDK reference is hand-written; no TypeDoc (ADR 0008).
- Some dependency upgrades are on hold; see the [upgrade watchlist](upgrade-watchlist.md).
