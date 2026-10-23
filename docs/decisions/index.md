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
| [0002](0002-games-in-sandboxed-iframe-on-own-origin.md) | Games run in a sandboxed iframe on their own origin | Accepted; in production on games.toheplay.io.vn since 0039, 0040 |
| [0003](0003-backend-dotnet-modular-monolith-postgres.md) | Backend: .NET 10 modular monolith + PostgreSQL | Accepted |
| [0004](0004-identity-households-and-profiles.md) | Identity: households, adult accounts and child profiles | Superseded by 0023 |
| [0005](0005-offline-first.md) | Offline first: games keep working without the API | Accepted; a ranked run needs the network to start, since 0030 |
| [0006](0006-docs-as-code.md) | Docs as code, rendered by Starlight, written for humans and agents | Accepted |
| [0007](0007-immutable-game-builds-and-catalog.md) | Immutable versioned game builds + a catalog indexed by the API | Accepted |
| [0008](0008-technology-baseline.md) | Technology baseline | Accepted; game default amended by 0012 |
| [0009](0009-local-environment.md) | Local environment: 47xx ports, compose, isolation | Accepted |
| [0010](0010-environments-dev-and-uat.md) | Environments: development and UAT on the homelab | Accepted; production decided by 0021; UAT deploys a uat- tag since 0041 |
| [0011](0011-password-sign-in-first.md) | Sign in with username and password first; OAuth later | Accepted; invites removed by 0023; email sign-in by 0024; manage PIN and step-up by 0025; OAuth by 0026 |
| [0012](0012-phaser-and-the-game-kit.md) | Phaser 4 and the game kit are the default way to build games | Accepted |
| [0013](0013-light-and-dark-themes.md) | Light and dark themes from shared design tokens | Accepted |
| [0014](0014-live-scores-for-long-runs.md) | Live scores for runs that last across sittings | Accepted; boards follow the server's clock and trust since 0029; ranked runs verified when they end since 0030 |
| [0015](0015-device-telemetry.md) | Collect technical telemetry from players' devices, first-party and visible | Accepted; the switch is the account's since 0023 |
| [0016](0016-online-rooms-for-turn-based-games.md) | Online rooms for turn-based games, refereed by the API with the game's own rules | Accepted; the seed's secrecy amended by 0017; household tables are account tables since 0023; calendar weeks and the two-people rule since 0029; invitations reach beyond the account by ID since 0033 |
| [0017](0017-replays-of-finished-online-hands.md) | Replay finished online hands with the game's own rules module | Accepted; a deleted player's seat shows as such since 0034 |
| [0018](0018-every-game-opens-on-its-own-main-menu.md) | Every game opens on its own main menu and has one menu button | Accepted; the screens amended by 0019 and 0020 |
| [0019](0019-game-shell-2-title-screen-hud-and-first-screen.md) | Give every game a title screen, a HUD and a pause that holds, from the kit | Accepted; stages amended by 0020; an entry opens play since 0045 |
| [0020](0020-a-game-has-a-menu-stage-and-a-play-stage.md) | Give every game a menu stage and a play stage | Accepted |
| [0021](0021-release-production-through-the-tohe-chart.md) | Release production through the Tò He Helm chart; one set of images configured at run time | Accepted; promotion follows a prod- tag since 0041; HSTS for subdomains and the site to serve only the docs by 0042 |
| [0022](0022-send-transactional-email-through-an-outbox.md) | Send transactional email through an outbox and an SMTP relay | Accepted |
| [0023](0023-accounts-own-their-profiles.md) | Accounts own their profiles; every profile has a public ID and a free name | Accepted; inviting by ID since 0033; deletion and retired IDs since 0034; the name filter since 0035 |
| [0024](0024-email-identifies-an-account.md) | Email identifies an account; a code opens only the attempt it was sent for | Accepted; email change behind step-up by 0025; signing up may need an invite code, or be closed, by 0028 |
| [0025](0025-step-up-in-two-levels-and-consent-at-sign-up.md) | Step up in two levels; sign up at 16 or older, accepting the terms | Accepted |
| [0026](0026-sign-in-methods-and-account-linking.md) | Sign in with Google, GitHub or an OpenID Connect issuer; link a provider by its subject, after proof | Accepted; a configured provider can be switched off by 0028 |
| [0027](0027-platform-admin-and-the-first-owner.md) | Run the platform from an admin console on the hub's origin; roles grant permissions; a setup token makes the first owner | Accepted; the console frames the games origin to watch a ranked run since 0032; the audit log keeps a year since 0034; the console moved to its own host, with a sign-in of its own, by 0042 |
| [0028](0028-sign-in-and-registration-at-run-time.md) | Switch sign-in methods and registration at run time; communities join by invite code | Accepted; the proof-of-work switch since 0037 |
| [0029](0029-integrity-engine-and-boards-by-trust.md) | One integrity engine gives every result a trust level from its evidence; boards read by trust | Accepted; a result left to people keeps its value since 0031; a deleted profile's results go with their decisions since 0034 |
| [0030](0030-ranked-runs-replayed-by-the-server.md) | Ranked runs: the server deals the seed, the game hands in its moves, the server replays them | Accepted; a ranked game also plays a run back to watch since 0032; not from an entry, since 0045 |
| [0031](0031-people-decide-what-the-engine-held.md) | People decide what the engine held: the console's review, and profiles hidden from public boards | Accepted |
| [0032](0032-watch-a-ranked-run-in-the-game-itself.md) | Watch a ranked run in the game itself, in the admin console | Accepted |
| [0033](0033-invite-a-profile-by-its-id.md) | Invite a profile to a table by its ID, as its owner allows; a child is never found from outside | Accepted |
| [0034](0034-delete-accounts-and-profiles-for-good.md) | Delete a profile at once and an account after seven days, with everything of them; the append-only logs get one way out each | Accepted; after its seven days an account waits for an admin since 0038 |
| [0035](0035-filter-offensive-names-and-limit-renames.md) | Refuse names with an offensive word, matched as people write it; an owner renames a profile five times a day | Accepted |
| [0036](0036-metrics-for-prometheus-on-a-port-of-its-own.md) | Export metrics for Prometheus with prometheus-net, on a port of the API's own | Accepted |
| [0037](0037-proof-of-work-before-a-code-by-email.md) | A self-hosted proof-of-work before a code by email, behind a switch of the console | Accepted |
| [0038](0038-an-account-waits-for-an-admin-after-its-seven-days.md) | After its seven days, an account waits for an admin to delete it; nothing deletes it by itself | Accepted |
| [0039](0039-games-on-a-domain-of-their-own.md) | Serve games from a registrable domain of their own | Accepted; all of Tò He on toheplay.io.vn since 0040 |
| [0040](0040-all-of-tohe-on-one-domain-of-its-own.md) | Run all of Tò He on toheplay.io.vn, the games one level below the hub | Accepted; hosts and paths laid out by 0042 |
| [0041](0041-promote-one-build-through-the-environments-by-tag.md) | Promote one build through the environments by tag; production runs only what ran on UAT | Accepted |
| [0042](0042-hosts-by-trust-paths-by-component.md) | Lay out Tò He by trust: one domain, a host per trust boundary, a path per component | Accepted; amended by 0046, 0047 |
| [0043](0043-device-profiles-and-identity-levels.md) | Every player is a profile of this device or of an account; the highest level any source needs is asked for | Accepted; arrives in steps (I1, I2); the game's level from 0045 |
| [0044](0044-entry-links.md) | Every way into Tò He is an entry; share links are objects on the server; one pipeline in the hub | Accepted; arrives with step I3; games take entries from 0045 |
| [0045](0045-games-declare-identity-and-entries.md) | A game declares the identity it needs and the entries it takes; it asks the hub for more, and to share | Accepted; arrives with step I4 |
| [0046](0046-player-surfaces-two-zones-one-frame.md) | Lay out the players' surfaces as two zones in one frame, and name the planes | Accepted; arrives in steps |
| [0047](0047-two-languages-and-an-introduction-surface-that-grows.md) | Speak Vietnamese first and English second, and grow the introduction surface from one source per game | Accepted; arrives in steps; game names and descriptions per language settled by 0048 |
| [0048](0048-a-standard-name-and-words-per-language-for-each-game.md) | Give each game a standard name, and a name and a description per language when it has them | Accepted |
| [0049](0049-a-crafted-toy-voice-and-look.md) | Make Tò He look and talk like a toy someone made: one icon set, its own type, a tò he palette, drawn pictures | Accepted; S1 in place, S2 building, S3 waits for the pictures |
| [0050](0050-a-game-declares-what-it-depends-on.md) | A game declares what it depends on; the platform provides it and keeps the guardrails | Accepted |
| [0051](0051-an-asset-studio-for-game-assets.md) | Make game assets in a Studio of Tò He's own; games pin them at build time | Accepted; arrives in steps (plans/asset-studio) |
| [0052](0052-agent-tokens-and-the-scopes-no-agent-gets.md) | Give agents named tokens with scopes, and keep a list of scopes no agent ever gets | Accepted; tokens in place, first scope used by the Studio |
| [0053](0053-assets-in-the-game-contract.md) | A game declares its asset packs in game.json and ships them pinned by hash | Accepted; the build tool and the kit's loader follow |
