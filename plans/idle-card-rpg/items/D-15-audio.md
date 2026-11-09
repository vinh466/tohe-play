# D-15 — Audio: SFX only

**Status:** decided — owner chose **chỉ SFX** on 2026-11-09 · **Kind:** decision · **Blocked by:** D-12, D-13

## Decision (owner's words)

> "Chỉ SFX"

- **No music** in v1: no theme loop, no battle loop, no music helper in P0.
- **SFX only**, through the game-kit's `createSfx` and `haptics`:
  - card hit / crit / block / death;
  - skill cast / ultimate;
  - summon / level-up / star-up / gear-up;
  - UI tap / sheet open / reward claim;
  - boss telegraph / victory / defeat.
- **Haptics**: short taps on card hit/crit/ultimate; respect `prefers-reduced-motion` and the sound setting.
- **Assets**: Studio audio packs (CC0/MIT/CC-BY), small OGG/WebM files; no music files.
- **P0**: the music helper is **removed** from the platform extension package (D-17).

## Why

- The owner prefers a leaner v1; SFX give the card clash its weight without a soundtrack to compose/produce.
- A good battle loop is a large art/production item; without music, the game still has hit-stop, shake and card shatter.
- The kit's SFX are already available; the game can add a few custom hits later.
- Music can be a v1.1 addition if the game feels dry; it does not block the platform.

## What it changes

- **D-17**: P0 = E-01 + asset on-demand + save 256 KB; no music helper.
- **D-13**: the card clash relies on SFX + haptics + FX, not music.
- **D-16**: the audio budget is ~20–30 SFX, no loops.
- **D-11**: audio assets via Studio packs; no music pipeline.

## Open

- Exact SFX list and which are custom vs kit.
- Volume/loudness normalization; mute behavior; haptics strength.
- Whether a v1.1 music loop is worth it; not now.

## Evidence

- Owner's words, 2026-11-09.
- `packages/game-kit/src/sfx.ts`, `haptics.ts`.
- [D-17 — Platform extension](D-17-platform-extension.md): P0 without music.

## Discussion

**owner (2026-11-09):** chose chỉ SFX.

**agent (2026-11-09):** recorded. This trims P0 and the art budget. The card clash must still feel heavy: hit-stop, shake, damage numbers, card shatter and a short thud/crit SFX carry it. Music is a later polish, not a v1 requirement.
