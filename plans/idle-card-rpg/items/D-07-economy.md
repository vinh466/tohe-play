# D-07 — Economy: offline combat, loot and summon

**Status:** researching — **offline combat decided**; currency/summon/pacing open · **Kind:** decision · **Blocked by:** D-06

## Decision (owner's words)

> "Offline vẫn đánh (Recommended)"

- While the app is closed, the company **keeps fighting** at the highest cleared stage.
- On return, the player gets a **summary card**: time away, waves cleared, gold/essence/gear/shards, and a "Nhận" button.
- **Cap: 12 h.** After the cap, the company waits; no "collect every 2 hours" pressure.
- No energy; no offline ticket; no premium currency.

## Proposed economy for v1

| Currency | Source | Sink |
|---|---|---|
| **Gold** | Stage clears, offline, daily | Hero/gear upgrades |
| **Essence** | Stage clears, offline, daily, tower | Star-ups |
| **Memory shards** | Stage clears, daily, tower, duplicates | Summon (hero acquisition) |

- **Summon**: 100 shards/pull, 900/10; pity 10 → Rare+, 50 → Epic; duplicates → shards; no limited banners in v1.
- **Gear**: drops from stages; 4 slots; fixed substats in v1; upgrade with gold.
- **No premium currency, no paid pull, no ads.**
- **Daily**: 3 tasks, 1 free pull, 1 expedition, 1 world boss; no streak punishment.
- **Offline rate**: based on the highest cleared stage; slower than active play, so playing still matters.

## Open

- Exact offline rate and cap (12 h proposed; maybe 8 h).
- Whether the offline summary gives gear or only currencies/shards (gear is the "farm" hook; recommend a small gear drop).
- Duplicate value: shards at 20% of star cost (proposal).
- Whether summon is a gacha or a deterministic "recruit" with a rotating pool. (Recommendation: earned gacha with visible pity; no money, so it is a collection ritual, not a monetization gate.)
- Whether gear has random substats (recommend fixed in v1; random later).
- Whether there is a "quick collect" once a day (recommend no; one summary on return is enough).

## What it changes

- **D-06**: progression costs and star/gear sinks.
- **D-09**: loot tables per stage; offline uses the highest cleared stage.
- **D-10**: daily tasks and the free pull.
- **D-12**: the offline summary card and the currency strip on the board.
- **D-16**: economy tuning is part of the simulation milestone.

## Evidence

- Owner's words, 2026-11-09.
- [R-02 — Progression & economy](../research/R-02-progression-economy.md): 12 h chest, no energy, 3 axes, one-week pacing.
- [R-01 — Genre landscape](../research/R-01-genre.md): AFK's idle chest; Legend of Mushroom's cautionary daily grind.

## Discussion

**owner (2026-11-09):** chose offline combat.

**agent (2026-11-09):** offline combat is the right fiction for a company on the road, and it matches the owner's "treo máy" intent. The risk is that offline becomes the main progression and active play feels pointless; the rate must be slower than active play. The summon should be generous and legible; without money, frustration has no business model to justify it.
