# D-05 — Card/character core: 6 heroes, 3 rows, 4 roles, 4 elements

**Status:** researching — **6 heroes / 3 rows** (owner changed from 4), 4 roles and 4 elements decided; rarity, gear, skills and bonds are open · **Kind:** decision · **Blocked by:** D-04

## Decisions (owner's words)

> "4 hero (Recommended)" → later changed to **"3 hàng / 6 hero"**

> "4 role / 4 element (Recommended)"

- **6 heroes** per team, arranged **3 rows × 2 columns** (front, mid, back).
- **4 roles**: Vanguard (tank), Blade (DPS), Seer (support/heal), Binder (control/debuff).
- **4 elements**: Ember, Tide, Stone, Gale; 1.25× advantage, 0.8× disadvantage; no hard gates.
- **Row preference**: Vanguard front; Blade front/mid; Binder mid/back; Seer back.

The 6-hero decision supersedes the earlier 4-hero phone math. The trade-off is explicit: 12 cards on screen, smaller card text, longer battles, more art/balance. The wireframe v3 must prove it reads at 360×640; if it does not, the owner can revert to 2×2/4 heroes.

## What is still open

| Sub-question | Options | Recommendation |
|---|---|---|
| **Formation** | 2×2 · 3 rows / 6 heroes | **3 rows / 6 heroes** (owner, 2026-11-09); front/mid/back, 2 columns; enemies use the same grid |
| **Rarity** | 3 tiers · 4 tiers · no rarity | **3**: Common, Rare, Epic; star 1–5; no "SSR" inflation |
| **Gear slots** | 4 · 6 | **4**: weapon, armor, charm, relic; 2-piece sets; no random substat rerolls in v1 |
| **Skills** | 1 active · 2 active · 1 basic + 1 active + 1 passive | **1 basic + 1 active + 1 passive**; active charges and auto-casts; passive unlocks at star 3/5 |
| **Synergy** | Element aura · role synergy · bonds | **Element aura (2/4/6)** + **one bond pair** per hero; keep it legible |
| **Stats** | 5 · 6 · 8 | **5**: HP, ATK, DEF, SPD, CRIT; control chance is a skill property, not a stat |

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

- [R-03 — Battle, card UX and pixel art](../research/R-03-battle-card-ux.md): card width math; 4 heroes.
- [R-01 — Genre landscape](../research/R-01-genre.md): Summoners War/Epic Seven use 4; AFK 5; Idle Heroes 6.
- [R-02 — Progression & economy](../research/R-02-progression-economy.md): 3 growth axes; gear as the farm chase.

## Discussion

**owner (2026-11-09):** chose 4 heroes, then 4 roles / 4 elements.

**agent (2026-11-09):** 4/4 is the right depth for a phone-first v1. Each role has a clear job, each element has a clear counter, and the enemy composition can pressure one role/element at a time without a hard gate. The remaining card details (rarity, gear slots, skills, bonds) should be kept to the smallest set that makes the board interesting; the recommendation table above is that set.
