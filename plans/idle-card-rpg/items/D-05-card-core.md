# D-05 — Card/character core: team size 4 decided; the rest open

**Status:** researching — owner chose **4 heroes** on 2026-11-09; roles, elements, rarity, gear and skills are open · **Kind:** decision · **Blocked by:** D-04

## Decision (owner's words)

> "4 hero (Recommended)"

A team is **4 heroes**, two rows (front/back). The research's phone math supports it: on a 360 px screen, four cards are ~78 px wide — enough for a portrait, name, HP bar and skill button. Five is tight; six is too small for a command card.

## What is still open

| Sub-question | Options | Recommendation |
|---|---|---|
| **Roles** | 3 (tank/DPS/support) · 4 (+control) | **4**: Vanguard (tank), Blade (DPS), Seer (support/heal), Binder (control/debuff) |
| **Elements** | 3 · 4 · 5 (with light/dark) | **4**: Ember, Tide, Stone, Gale; 1.25× advantage, 0.8× disadvantage; no hard gates |
| **Rarity** | 3 tiers · 4 tiers · no rarity | **3**: Common, Rare, Epic; star 1–5; no "SSR" inflation |
| **Gear slots** | 4 · 6 | **4**: weapon, armor, charm, relic; 2-piece sets; no random substat rerolls in v1 |
| **Skills** | 1 active · 2 active · 1 basic + 1 active + 1 passive | **1 basic + 1 active + 1 passive**; active charges and auto-casts; passive unlocks at star 3/5 |
| **Synergy** | Element aura · role synergy · bonds | **Element aura (2/4)** + **one bond pair** per hero; keep it legible |
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

**owner (2026-11-09):** chose 4 heroes.

**agent (2026-11-09):** 4 is the right call for a phone-first card RPG. It also makes each hero's card a real character, not a stat stick. The next decision is the role/element matrix; I recommend 4 roles and 4 elements, with enemies that pressure one role or element at a time, never a hard gate.
