# D-06 — Progression: company level, star, gear

**Status:** decided — owner chose **Company + star + gear** on 2026-11-09 · **Kind:** decision · **Blocked by:** D-05, D-17

## Decision (owner's words)

> "Company + star + gear (Recommended)"

Three growth axes:

1. **Company level** (account): shared by every hero; raises the hero level cap, base stats and the offline rate. One number, not twelve.
2. **Stars** (per hero): 1–5; shards from duplicates, story, daily, tower; +stats and a passive unlock at 3 and 5. The collection chase.
3. **Gear** (per hero): 4 slots — weapon, armor, charm, relic; 2-piece sets; upgrade +0…+5 with gold; fixed substats in v1. The farm chase.

**Not in v1:** individual hero levels, skill books, prestige/rebirth, rune substat rerolls, 6 gear slots, furniture, mounts, artifacts, pets, tech trees.

## Why 3 axes

- It matches the owner's "progression is the strength" without the 8–11 verticals that make Legend of Mushroom a chore.
- Company level removes the "level 12 heroes one by one" grind; the player can swap teams freely.
- Stars and gear give two different feelings: **collection** (stars) and **farm** (gear). They do not compete for the same currency.
- The board is the main screen; every extra axis is another sheet. Three axes is the most that still fits a 5-minute session.

## Proposed curve (to be simulated)

| Axis | Range | Effect | Cost |
|---|---|---|---|
| Company level | 1–20 (v1) | +8–12% base stats per level; unlocks stages/gear tiers | XP from stages/offline |
| Stars | 1–5 | +15–20% stats per star; passive at 3/5 | Hero shards |
| Gear | 4 slots, +0…+5 | Main stat + set bonus; +10% per plus | Gold + drops |

- Power = a derived score from HP/ATK/DEF/SPD/CRIT; the stage preview shows "recommended power".
- No hard level gates: a stage can be attempted under-power; the preview warns, it does not lock.
- Star shards are never wasted: duplicates always convert; a maxed hero's duplicates become a universal shard.

## What it changes

- **D-07**: gold/essence/shards sources and sinks; gear drops; offline rate.
- **D-09**: stage power curve, gear tiers and star shard rewards.
- **D-12**: the hero sheet needs star, gear slots and a "power" line; the board shows stars/element.
- **D-13**: star pips, gear rarity frames, set icons.
- **D-16**: the balance simulation is a v1 milestone.

## Open details

- Exact stat formulas, star shard costs and gear tier cadence: D-11's simulation.
- Whether stars are per-hero only or also a team "rank": per-hero only.
- Whether gear sets are 2-piece only or 2/4: 2-piece only in v1; 4-piece is a v2 candidate.
- Whether company level is called "Cấp đoàn" or something in-world: D-14 naming.

## Evidence

- Owner's words, 2026-11-09.
- [R-02 — Progression & economy](../research/R-02-progression-economy.md): 3 axes, 12 h idle, no energy.
- [R-01 — Genre landscape](../research/R-01-genre.md): AFK's ascension/gear; Idle Heroes' depth vs grind.
- [R-06 — Main-screen auto-battler UX](../research/R-06-main-screen-ux.md): one main screen, sheets for systems.

## Discussion

**owner (2026-11-09):** chose company level + star + gear.

**agent (2026-11-09):** recorded. This is the right depth for v1: three axes, three different feelings (account growth, collection, farm), and no axis that requires a spreadsheet to understand. The simulation must prove the one-week pacing before content art is produced.
