---
title: "0051: Make game assets in a Studio of Tò He's own; games pin them at build time"
description: Agents (mostly) and people make, check and submit packs of game assets to a Studio of Tò He's own on studio.; a reviewer approves them; approved files are published once, by hash, to object storage; a game pins pack versions and gets the files at build time — never the latest at run time.
sidebar:
  order: 51
---

- **Status:** Accepted
- **Date:** 2026-10-24
- **Amends:** [ADR 0046](0046-player-surfaces-two-zones-one-frame.md) — the Developers plane's `studio.` has a session
  of its own (its row said "public, no session"); [ADR 0042](0042-hosts-by-trust-paths-by-component.md) — `studio.`
  moves from kept for later to decided.
- **Decided by:** the owner, 2026-10-22 to 2026-10-24, in plans/asset-studio (D-02, D-05 to D-09, D-11, D-13, D-14):
  "ok chốt", "D-05 on", "chốt B nhé", "D-11 ổn nha", "ổn đó", "ok chốt theo đề xuất".

## Context

Every game on Tò He draws its pictures in code; there is not one picture file in the repository. The next games in the
backlog — a farm, a light RPG — need many varied, attractive pictures. Phaser 4 loads images, sprite sheets, atlases,
tile maps and audio, so the engine is not the obstacle; what is missing is a place to make, check, keep and hand out
assets ([ADR 0012](0012-phaser-and-the-game-kit.md); plans/asset-studio R-01).

The owner wants that place to be Tò He's own: "1 Studio mở cho AI connect và làm việc, người thì hỗ trợ upload … các game
sẽ phải phụ thuộc chính vào đây, giúp Tò He kiểm soát được asset tập trung". AI image models are good at icons, portraits
and backgrounds and weak at keeping one style across a set; a style kept by tools and a human review is what makes a set
look like one game (R-01).

What must keep holding: the games' sandbox and CSP (`connect-src 'self'`,
[ADR 0002](0002-games-in-sandboxed-iframe-on-own-origin.md)); offline first
([ADR 0005](0005-offline-first.md)); immutable builds ([ADR 0007](0007-immutable-game-builds-and-catalog.md)); ranked runs
the server replays ([ADR 0030](0030-ranked-runs-replayed-by-the-server.md)). The repository is public and children play.
Agents never write to production ([ADR 0041](0041-promote-one-build-through-the-environments-by-tag.md)).

## Decision

### Games pin; the Studio never changes a built game

Following [ADR 0050](0050-a-game-declares-what-it-depends-on.md), a game declares the packs it uses, each with a version
and a delivery mode. The files are fixed by hash in the game's lock when it is built.

| Delivery | What | Offline | Counts against |
| --- | --- | --- | --- |
| `bundle` | in the build | always | `sizeBudgetKb` |
| `precache` *(later)* | files by hash on the games origin, fetched to the device the first time | after the first fetch | the device's storage |
| `on-demand` *(later)* | fetched when needed; the game handles a failure | that part needs the network | nothing in the build |

Only `bundle` exists now. `precache` and `on-demand` are added when spike S1 has an answer and a game needs one; adding a
value is additive in protocol 1. The contract's side comes with the change to the contract, in ADR 0053.

**Guardrails no declaration changes:**

1. Files come only from Tò He's own origins — never an arbitrary address.
2. A game pins every file by hash at build time. "Later" is about *when* a file is fetched, never *which*.
3. Only approved assets are used. A published version is never deleted; it can be deprecated, or withdrawn (below).
4. Conformance checks the delivery mode the game declared.
5. Data that changes the rules (an item's numbers, a recipe) is in the game's code, never in the Studio: a table's
   rules and a ranked run's replay depend only on the build.

### What an asset is: packs

- A **pack** is a set of assets in one style for one purpose (`farm-crops`, `ui-icons`), released together under
  semver. Patch: pixels change, not sizes or frames. Minor: assets added. Major: an asset removed, renamed or resized.
- Every file has a **sha256**. Kinds now: `image`, `spritesheet` (frames and animations), `tileset` (tile size, optional
  Wang or autotile rules), `audio`, `font`, `palette`. A map is the game's content and refers to a tileset.
- Every asset records its **source** — a pack it came from, an upload, an AI model (vendor, model, prompt, seed, date),
  or code (the script, kept with it) — its licence (SPDX), its style, and who approved it and when.

### Styles belong to the game

A style is an **art bible** kept in the Studio: palette, tile size, view, outline, sample pictures. A pack names its
style. Tò He's own style is one of them, the one to use when a game has no idea of its own; a game chooses or makes the
style that suits it, and a later change of Tò He's style does not touch a game that pinned its packs.

### Licences

- **Accepted:** CC0, CC-BY 4.0, OFL 1.1 (fonts), MIT, BSD, Apache-2.0. **CC-BY-SA:** the owner decides case by case.
- **Refused:** NC, ND, "free for personal use", anything unclear.
- **Made by AI:** accepted with its full source, from a vendor whose terms allow commercial use and redistribution, and
  always reviewed by a person. A picture made only by a model may not be protected by copyright (US Copyright Office,
  2025); for a family platform that is acceptable.
- **Made for Tò He** (by its people or its agents): `LicenseRef-Tohe-Internal` — used only in Tò He's games — until
  the repository chooses a licence for its code, and the two are decided together.
- **Credits** are generated from each game's lock and shown in the game.

### Where things live

- **State** — styles, packs, versions, files, status, sources, reviews, the audit log — is in PostgreSQL, in a `Studio`
  module of the API, schema `studio`.
- **Files** are in object storage, by hash: drafts private, approved files public to read. On approval the Studio writes
  each version's **manifest**, `packs/<id>/<version>.json` (its files and their hashes), which never changes after.
- **One library for every environment**, like a package registry: a build carries its files, and builds are promoted
  from UAT to production by tag, so the library is not split by environment. Production uses Cloudflare R2; the dev
  stack runs MinIO for work on the Studio itself.
- **A build needs only the bucket**, never the API: it reads the manifest, fetches files by hash, checks every hash. A
  shared cache by hash (one folder for every worktree on a machine, and CI's cache) means a file is fetched once;
  `--offline` fails naming what is missing. A build with a cold cache while storage is down fails, and says so.

### Who does what

| Who | How they sign in | May |
| --- | --- | --- |
| An agent | a token with the `studio.draft` scope ([ADR 0052](0052-agent-tokens-and-the-scopes-no-agent-gets.md)) | create and change its drafts, upload draft files, run the checks without saving |
| A contributor | a Tò He account with the studio role `contributor` | the same, in the Studio app |
| A reviewer | a Tò He account with the studio role `reviewer` and two-factor authentication | approve or reject a pack version, deprecate one; the owner alone withdraws |
| CI and builds | nobody: approved files are public | read manifests and files |
| An operator | the console | give and take studio roles, give and revoke agent tokens, read the Studio's audit |

**An agent creating drafts in the production Studio with its token is the one exception** to "an agent never writes to
production" ([ADR 0041](0041-promote-one-build-through-the-environments-by-tag.md)). It never approves, never touches the
cluster, and the owner can revoke its token at any moment.

### Checks and review

- **The server checks** every draft upload and checks again on approval; an agent can ask for the checks without saving
  (`--dry-run`). Files: allowed formats, magic bytes match, metadata stripped, a limit on pixels and bytes. Pictures:
  sizes in multiples of the style's tile; a sprite sheet's frame grid matches its metadata; for a pixel-art style every
  pixel in the palette and alpha only 0 or 255; a Wang tileset's edges meet. Metadata, licence and source complete;
  semver against the previous version.
- **A reviewer** looks for what a machine cannot: suitable for children (no gore, nothing frightening, no text, logos or
  likeness of real people), not a near copy of a known character or game, in the style, readable at its real size (the
  previews at 1× and 2×, on light and dark), a plausible source.
- **A whole pack version** is approved or rejected, never single files. A rejection gives a reason; a fix is a new
  draft. A draft nobody reviews is removed after 30 days; the drafts area has a quota.
- **Withdrawal** is the exception to "never deleted": the owner, with a second factor and a reason (a takedown, say),
  marks a version `withdrawn` and its files are deleted. A game pinned to it fails to build, naming why, and needs a new
  version. It is logged.

### The Studio is an app of its own

`apps/studio` on `studio.toheplay.io.vn`: its own session (cookie `__Host-tohe.studio`), its own CSP, served by a third
site of the hub image's Caddy that passes on `/api/studio/*` and nothing else of the API — the same shape as the console
([ADR 0027](0027-platform-admin-and-the-first-owner.md)). A studio role is an account claim of its own, not a platform
role: contributing to the Studio gives no power over the platform, and a stolen Studio session or token cannot act as an
operator. The console stays the control plane. The app is called "Studio"; "Xưởng tò he" is the name of the platform's
look ([ADR 0049](0049-a-crafted-toy-voice-and-look.md)).

### Tools for agents

A CLI, `tohe-studio` (`packages/studio`), for agents with a shell: read styles, start a pack, `import` from a known
CC0 or CC-BY pack with its source filled in, `draw` with a script (the script is kept, so code-drawn assets can be made
again), `prepare` (fit to the style's palette, snap to the pixel grid, trim, strip metadata), `check --dry-run`,
`submit`, `status`. Atlases and compression are the game's build's job, not the Studio's: a pack keeps single files.
Later: `generate` through vendors whose terms were checked, once the owner sets a budget, and an MCP server over the
same core.

### Not done now

`precache` and `on-demand`; generators and the MCP server; uploads by people (the Studio app shows, approves and rejects
first); 3D, video; a market of assets; assets players upload (`media.`, ADR 0042).

## Consequences

- New: `docs/architecture/asset-studio.md`; a `Studio` module and `studio` schema; `apps/studio`; `packages/studio`;
  a host `studio` in `@tohe/routes`, decided now, serving once its DNS, ingress and bucket exist (the owner's, with
  `platform-infra`).
- The exception for agents goes into `AGENTS.md` and the environment rules of *Working with agents*.
- ADR 0053 changes the Game Contract, in the same pull request as the contract and its conformance checks.
- The kit gains a pack loader and a credits screen; `/new-game` gains choosing a style and packs.
- A pilot (a slice of the farm game) proves it: sizes, frame times and save sizes measured on phones.

## Alternatives considered

- **Games fetch the latest approved asset at run time:** the most flexible, and it breaks the sandbox's single origin,
  offline play, immutable builds and replays at once; an approved build would change its look without review. Roblox's
  Creator Store forbids it for the same reasons.
- **Assets in the repository, reviewed as pull requests:** cheapest to start and the agent's first proposal; the owner
  chose storage and a database from the start, to avoid a migration later, keep the public repository small and allow
  music now.
- **A Studio inside the console:** cheapest to build, but contributing would need a platform role, and a flaw in a Studio
  page would act with an operator's session.
- **One Tò He style for every game:** consistent, but every game would look alike, and changing Tò He's style would mean
  redrawing every game.
