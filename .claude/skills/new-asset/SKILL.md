---
name: new-asset
description: Make a pack of game assets for the Tò He Asset Studio — choose a style, take files from a known free pack or draw them with code, fit them to the style, check them with the Studio and submit them for a person to review. Use when a game needs pictures, sprites, tiles, icons, sounds or fonts, or when asked to add, make or import assets.
---

# New asset pack

Follow `docs/guides/make-assets.md` (the commands, the checks, licences and sources) and ADR 0051. You make drafts
with an agent token; **a person reviews every pack** — you never approve one, and nothing reaches a game until it is
approved (ADR 0052).

## 1. Before anything

1. `TOHE_STUDIO_URL` (the Studio's host — `http://localhost:4722` in dev once the Studio app runs, the hub's host
   until then) and `TOHE_STUDIO_TOKEN` (`tohe_at_…`, given by the owner in the console's Agents page) are set. Never
   print, log or commit the token. Without one, stop and ask the owner for it.
2. Read what the game's `SPEC.md` says about its style, orientation and the packs it needs. No spec yet: the game comes
   first (`/new-game`).

## 2. Plan the pack

- **Style**: `pnpm studio style list`, `pnpm studio style show <id>`. Use the one the spec names; Tò He's own is the
  default for a game with no idea of its own. A new style is a proposal to the owner, not something to invent quietly.
- **Id and version**: a pack is one style and one purpose (`farm-crops`, not `farm-everything`); semver — a new pack
  starts at `1.0.0`; removing, renaming or resizing an asset is a major version.
- **Source of every file**, in this order of preference:
  1. a known free pack (`pnpm studio import --list`; CC0 first);
  2. a drawing script (`pnpm studio draw`) for simple shapes, icons and tiles a script draws well;
  3. never a file from the web whose licence you cannot name, and never a picture of a known character or game.
  AI generators are not set up yet (no budget); do not use one.

## 3. Make it

```sh
pnpm studio pack init .studio-work/<pack> --id <pack> --style <style> --version 1.0.0
pnpm studio import <source> .studio-work/<pack> --include '<glob>'   # or: pnpm studio draw <script> .studio-work/<pack>
pnpm studio prepare .studio-work/<pack> --palette --binary-alpha       # pixel styles; --trim only for single images
```

Fill in `pack.json`: each asset's `kind` (sprite sheets need `frames`), `tags`, the licence and, when the licence asks,
the attribution. Keep ids short and stable (`crops/carrot`): games use them as keys.

## 4. Check, then submit

```sh
pnpm studio check .studio-work/<pack>     # the server's checks, nothing submitted
pnpm studio submit .studio-work/<pack>
pnpm studio status <pack>@<version>
```

Fix every problem `check` names (the codes are in the guide) before submitting; never work around a check. Then tell
the owner the pack is waiting in the Studio for review, with what it is for, its sources and licences.

## 5. After the review

- **Approved**: the game declares the pack in `public/game.json`'s `assets`, runs `pnpm assets:resolve` and loads it
  with `loadPack` (`docs/guides/use-assets-in-a-game.md`).
- **Rejected**: read the reason (`status`), change the pack, submit it again as a new draft.

Report: the pack and version, its style, the sources and licences of its files, the check output, and its status.
