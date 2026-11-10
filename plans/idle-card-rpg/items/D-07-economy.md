# D-07 — Economy: offline combat, loot and earned gacha (decided)

**Status:** decided — owner chose **Earned gacha + pity** on 2026-11-09 · **Kind:** decision · **Blocked by:** D-06

## Decisions (owner's words)

> "Offline vẫn đánh (Recommended)"

> "Earned gacha + pity (Recommended)"

- While the app is closed, the company **keeps fighting** at the highest cleared stage.
- On return, the player gets a **summary card**: time away, waves cleared, gold/essence/gear/shards, and a "Nhận" button.
- **Cap: 12 h.** After the cap, the company waits; no "collect every 2 hours" pressure.
- No energy; no offline ticket; no premium currency.
- **Summon**: earned currency only, 10-pull, visible pity; no money, no limited banners.
- **No premium currency, no paid pull, no ads.**

## The v1 economy

| Currency | Source | Sink |
|---|---|---|
| **Gold** | Stage clears, offline, daily | Hero/gear upgrades |
| **Essence** | Stage clears, offline, daily, tower | Star-ups |
| **Memory shards** | Stage clears, daily, tower, duplicates | Summon (hero acquisition) |

- **Summon**: 100 shards/pull, 900/10; **pity 10 → Rare+, 50 → Epic**; duplicates → shards; no limited banners in v1.
- **Gear**: drops from stages; 4 slots; fixed substats in v1; upgrade with gold.
- **Daily**: 3 tasks, 1 free pull, 1 expedition, 1 boss; no streak punishment.
- **Offline rate**: based on the highest cleared stage; slower than active play, so playing still matters.
- **Duplicate value**: shards at ~20% of the star cost; a maxed hero's duplicates become universal shards.
- **Quick collect**: none; one summary on return is enough.

## Why earned gacha

- The owner wants a collection game; a gacha is a genre ritual, not a monetization gate.
- With no IAP, the gacha can be **generous and legible**: visible pity, no FOMO, no limited banners.
- Duplicates always convert, so a pull is never worthless.
- A deterministic-only recruit would be calmer but loses the "open a card" moment the owner enjoys.

## What it changes

- **D-06**: progression costs and star/gear sinks.
- **D-09**: loot tables per stage; offline uses the highest cleared stage.
- **D-10**: daily tasks and the free pull.
- **D-12**: the offline summary card, the currency strip, the summon sheet and pity bar.
- **D-16**: economy tuning is part of the simulation milestone.

## Open (tuning, not decisions)

- Exact offline rate and gear-drop share.
- Exact pity rates and shard costs; the 10/50 split is a starting point.
- Whether the free pull is daily or every 3 days.
- Whether gear has random substats (fixed in v1; random later).

## Evidence

- Owner's words, 2026-11-09.
- [R-02 — Progression & economy](../research/R-02-progression-economy.md): 12 h chest, no energy, 3 axes.
- [R-01 — Genre landscape](../research/R-01-genre.md): AFK's generous gacha without money; Legend of Mushroom's cautionary grind.

## Discussion

**owner (2026-11-09):** chose offline combat, then earned gacha + pity.

**agent (2026-11-09):** recorded. This is the right shape for a no-IAP collection game: the gacha is a ritual, not a wall; pity is visible; duplicates always convert. The simulation should prove the shard income supports ~20 heroes over ~2 weeks without making the summon trivial.
