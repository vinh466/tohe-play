# D-05 — Card/character core: 6 heroes, 3 rows, 4 roles, 4 elements (decided)

**Status:** decided — owner chose 6 heroes / 3 rows, 4 roles, 4 elements, and the proposed card details on 2026-11-09 · **Kind:** decision · **Blocked by:** D-04

## Decisions (owner's words)

> "3 hàng / 6 hero"

> "4 role / 4 element (Recommended)"

> "Theo đề xuất (Recommended)" (rarity, gear, skills, bonds)

- **6 heroes** per team, arranged **3 rows × 2 columns** (front, mid, back).
- **4 roles**: Vanguard (tank), Blade (DPS), Seer (support/heal), Binder (control/debuff).
- **4 elements**: Ember, Tide, Stone, Gale; 1.25× advantage, 0.8× disadvantage; no hard gates.
- **Row preference**: Vanguard front; Blade front/mid; Binder mid/back; Seer back.
- **3 rarities**: Common, Rare, Epic; star 1–5.
- **4 gear slots**: weapon, armor, charm, relic; 2-piece sets; +0…+5; fixed substats in v1.
- **Skills**: 1 basic + 1 active + 1 passive; active charges and auto-casts; passive unlocks at star 3/5.
- **Bonds**: one bond pair per hero; a small bonus when deployed together.
- **Stats**: HP, ATK, DEF, SPD, CRIT; control chance is a skill property.

The 6-hero decision supersedes the earlier 4-hero phone math. The owner accepted the density after seeing wireframe v3 (12 cards, full info on each card). The risk is real: 8 px names at 380 px; test at 360×640 during implementation.

## What is still open

Nothing at the decision level. The exact numbers (star shard costs, gear tier cadence, skill multipliers) belong to D-06/D-07 and the balance simulation (D-11).

## Proposed card anatomy

```
┌────────────────────┐
│ [element gem]  [★3]│  rarity frame, element, stars
│                    │
│   64×64 portrait   │  pixel portrait + role icon
│                    │
│  Tên hero          │
│  ▰▰▰▰▰▱  HP        │
│  [skill ring]      │  active skill charge
└────────────────────┘
```

- **Front row**: +DEF, draws melee, protects the back.
- **Back row**: +ATK, safer from melee, some skills hit rows.
- **Bond**: two heroes that share a history get a small bonus when deployed together; a collection hook, not a second gear system.
- **Element**: shown by an icon + colour + shape, never colour alone.

## What it changes

- **D-06**: growth axes (company level, star, gear) are built on these stats.
- **D-07**: summon pool and duplicate value depend on rarity/stars.
- **D-09**: enemy compositions use the same roles/elements; stages can pressure specific roles.
- **D-12**: hero list/detail/formation screens; 2×2 formation.
- **D-13**: card frame, portrait, skill ring, element gem, star pips.

## Evidence

- [R-03 — Battle, card UX and pixel art](../research/R-03-battle-card-ux.md): card width math; 6-hero density.
- [R-01 — Genre landscape](../research/R-01-genre.md): Summoners War/Epic Seven use 4; AFK 5; Idle Heroes 6.
- [R-02 — Progression & economy](../research/R-02-progression-economy.md): 3 growth axes; gear as the farm chase.

## Discussion

**owner (2026-11-09):** chose 6 heroes / 3 rows, 4 roles / 4 elements, and the proposed card details (3 rarity, 4 gear slots, 1 basic + 1 active + 1 passive, bonds, 5 stats).

**agent (2026-11-09):** recorded. This is a deep card core for a v1: 6 heroes, 3 rows, 4 roles, 4 elements, 3 rarities, 4 gear slots, 3 skills and bonds. The risk is not depth but **surface**: every axis needs a readable icon/label on a small card. The board keeps full info (owner: "Ổn, giữ nguyên"); the hero sheet carries the detail. The implementation must test 360×640 early.
