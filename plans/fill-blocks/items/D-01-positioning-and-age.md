# D-01 — Positioning, age and promise

**Status:** decided — owner approved the recommended option on 2026-11-08 ("ok tốt nha, làm đi") · **Kind:** decision · **Blocked by:** —

## Question

Who is Lấp Ô for, and what promise does the title screen make?

## Options

### A — Everyone, a child can play (recommended)

- `minAge: 3` stays. The endless mode is the child's mode: tap-to-place, helpful draw, no timer, no reading.
- The journey and daily are optional layers for older players; they do not gate the endless mode.
- The shelf register stays 16+ (ADR 0057); the game's own voice is warm and plain, never childish.
- The public page says "for anyone who likes a calm block puzzle; a child can play with a tap".

**Cost:** the UI must work without reading (icons, numbers, audio), and the first run must be genuinely
playable by a small child. More accessibility work, no platform change.

### B — 6+ for the whole game

- `minAge: 6`; the journey is the main mode; goals can use short words; less assist work.
- Simpler to design, but it gives up the "child in the family" story and the current spec's minAge 3.

### C — 16+ competitive

- `minAge: 16`; ranks and leaderboards first; no child register.
- Misaligned with Tò He's family layer and the current spec; reject.

## Recommendation

**A**, with a clear split: **endless = the child's mode; journey/daily = the older player's mode.** The game
never asks a 3-year-old to read a goal; the first screen is the board. If the first playtest shows the endless
mode is too harsh for a small child, lower the claim to 6+ and add a "Bé" assist later — do not fake 3+ with a
game a 3-year-old cannot play.

## What it changes

- D-02: assists (hint, undo, rescue) are part of the child promise.
- D-03: the journey is optional, not the only door.
- D-06: title screen must show two clear doors; no text wall.
- D-07: colour + shape, not colour alone; large targets.
- The public page's `minAge` and copy.

## Evidence

- The current spec already chose tap-to-place and a helpful draw for small children:
  `games/fill-blocks/SPEC.md`.
- UX research on no-reading onboarding and large targets: [R-02](../research/R-02-ux-and-retention.md).
- The shelf's 16+ register and family layer: ADR 0057, `docs/architecture/surfaces.md`.

## Discussion

**agent (2026-11-08):** recommend A; the endless mode is the child's mode, the journey is the long-term layer.
The owner should confirm the age claim after the first playtest with a child.
