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
| [0004](0004-identity-households-and-profiles.md) | Identity: households, adult accounts and child profiles | Superseded by 0023 |
| [0005](0005-offline-first.md) | Offline first: games keep working without the API | Accepted; a ranked run needs the network to start, since 0030 |
| [0006](0006-docs-as-code.md) | Docs as code, rendered by Starlight, written for humans and agents | Accepted |
| [0007](0007-immutable-game-builds-and-catalog.md) | Immutable versioned game builds + a catalog indexed by the API | Accepted |
| [0008](0008-technology-baseline.md) | Technology baseline | Accepted; game default amended by 0012 |
| [0009](0009-local-environment.md) | Local environment: 47xx ports, compose, isolation | Accepted |
| [0010](0010-environments-dev-and-uat.md) | Environments: development and UAT on the homelab | Accepted; production decided by 0021 |
| [0011](0011-password-sign-in-first.md) | Sign in with username and password first; OAuth later | Accepted; invites removed by 0023; email sign-in by 0024; manage PIN and step-up by 0025; OAuth by 0026 |
| [0012](0012-phaser-and-the-game-kit.md) | Phaser 4 and the game kit are the default way to build games | Accepted |
| [0013](0013-light-and-dark-themes.md) | Light and dark themes from shared design tokens | Accepted |
| [0014](0014-live-scores-for-long-runs.md) | Live scores for runs that last across sittings | Accepted; boards follow the server's clock and trust since 0029; ranked runs verified when they end since 0030 |
| [0015](0015-device-telemetry.md) | Collect technical telemetry from players' devices, first-party and visible | Accepted; the switch is the account's since 0023 |
| [0016](0016-online-rooms-for-turn-based-games.md) | Online rooms for turn-based games, refereed by the API with the game's own rules | Accepted; the seed's secrecy amended by 0017; household tables are account tables since 0023; calendar weeks and the two-people rule since 0029 |
| [0017](0017-replays-of-finished-online-hands.md) | Replay finished online hands with the game's own rules module | Accepted |
| [0018](0018-every-game-opens-on-its-own-main-menu.md) | Every game opens on its own main menu and has one menu button | Accepted; the screens amended by 0019 and 0020 |
| [0019](0019-game-shell-2-title-screen-hud-and-first-screen.md) | Give every game a title screen, a HUD and a pause that holds, from the kit | Accepted; stages amended by 0020 |
| [0020](0020-a-game-has-a-menu-stage-and-a-play-stage.md) | Give every game a menu stage and a play stage | Accepted |
| [0021](0021-release-production-through-the-tohe-chart.md) | Release production through the Tò He Helm chart; one set of images configured at run time | Accepted |
| [0022](0022-send-transactional-email-through-an-outbox.md) | Send transactional email through an outbox and an SMTP relay | Accepted |
| [0023](0023-accounts-own-their-profiles.md) | Accounts own their profiles; every profile has a public ID and a free name | Accepted |
| [0024](0024-email-identifies-an-account.md) | Email identifies an account; a code opens only the attempt it was sent for | Accepted; email change behind step-up by 0025; signing up may need an invite code, or be closed, by 0028 |
| [0025](0025-step-up-in-two-levels-and-consent-at-sign-up.md) | Step up in two levels; sign up at 16 or older, accepting the terms | Accepted |
| [0026](0026-sign-in-methods-and-account-linking.md) | Sign in with Google, GitHub or an OpenID Connect issuer; link a provider by its subject, after proof | Accepted; a configured provider can be switched off by 0028 |
| [0027](0027-platform-admin-and-the-first-owner.md) | Run the platform from an admin console on the hub's origin; roles grant permissions; a setup token makes the first owner | Accepted |
| [0028](0028-sign-in-and-registration-at-run-time.md) | Switch sign-in methods and registration at run time; communities join by invite code | Accepted |
| [0029](0029-integrity-engine-and-boards-by-trust.md) | One integrity engine gives every result a trust level from its evidence; boards read by trust | Accepted; a result left to people keeps its value since 0031 |
| [0030](0030-ranked-runs-replayed-by-the-server.md) | Ranked runs: the server deals the seed, the game hands in its moves, the server replays them | Accepted |
| [0031](0031-people-decide-what-the-engine-held.md) | People decide what the engine held: the console's review, and profiles hidden from public boards | Accepted |
