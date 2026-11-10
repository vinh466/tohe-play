# R-02 — Progression, economy and pacing

Date: 2026-11-09 · Status: first pass

Question: làm sao để tiến trình vừa sâu vừa không thành grind/FOMO, trong giới hạn một game offline 64 KB save?

## Facts from the references

| Fact | Source |
|---|---|
| AFK's idle chest fills for **12 hours**, then stops until collected; the design targets **two sessions a day** (morning/evening). | Game Developer, *Flexible time session design in AFK Arena* |
| AFK has **no energy** on its open progression modes; the player is blocked by team power, not by a stamina bar. | Alexandre Macmillan, *Idle mechanics…* |
| AFK's campaign stages are **one-time clears**; the idle reward rate depends on the highest stage reached. | Deconstructor of Fun, *AFK Arena* |
| AFK uses **ascension (duplicates)** as a level-cap gate; spending alone cannot buy the XP/essence needed to level. | Alexandre Macmillan |
| Idle Heroes upgrades heroes on **stars (to 10), level, 6 equipment slots and skills**; faction auras reward mixed rosters. | Deconstructor of Fun, *Idle Heroes* |
| Idle Heroes' 5★→10★ path can require **400–500 four-star heroes** as fodder — deep, but a grind wall. | Deconstructor of Fun, quoting Jeff Witt |
| Summoners War uses **6 rune slots**, sets of 2/4, main stats and substats; rune quality is the long chase. | Troy Dunniway, *Summoners War Breakdown* |
| Epic Seven uses **4 heroes**, a **Combat Readiness** gauge; speed decides who acts first, with a ±5% speed variance. | Epic7x, *Combat Readiness Guide* |
| Legend of Mushroom has **11 progression verticals** unlocked over the first 14 days; the daily lamp-opening loop takes **1–2 real hours**. | Deconstructor of Fun, *Legend of Mushroom* |

## The core problem

The genre's depth comes from **many overlapping growth axes** and **random gear**. Those are also what make it grindy and monetizable. Tò He cannot sell shortcuts, so every wall must have a free, legible path around it. The design target is:

> **Deep enough that a min-maxer can theorycraft for weeks; calm enough that a 10-minute player never feels behind.**

## A progression budget for v1

| Axis | What grows | Why it stays | Cost |
|---|---|---|---|
| **Camp level** (account) | Hero level cap, idle rate, building unlocks | One number the whole roster shares; avoids leveling 12 heroes | Low |
| **Stars** (per hero) | +stats, passive unlock at 3/5 | Collection/duplicate chase; makes each hero feel owned | Medium |
| **Gear** (4 slots) | Main stat + set bonus, +0…+5 | The "farm" chase; drops from stages; legible upgrades | Medium |
| **Skill unlocks** | Ultimate upgrades at star 3/5, passive at 5 | Ties stars to battle feel without a separate skill currency | Low |

Deliberately **not in v1**: rune substat rerolls, 6 gear slots, furniture, signature items, mounts, artifacts, relics, pets, tech trees, garden, souls, prestige/rebirth. Each is a v2 candidate only if the v1 loop proves it needs another layer.

## Economy sketch (to be simulated)

| Currency | Source | Sink |
|---|---|---|
| **Gold** | Stages, idle chest, camp farm, daily | Hero/gear upgrades, building upgrades |
| **Essence** | Stages, idle chest, daily, tower | Star-ups |
| **Memory shards** | Stages, daily, tower, duplicates | Summon (hero acquisition) |
| **Camp supplies** | Camp buildings, daily | Building upgrades (or fold into gold for v1) |

- **Idle cap: 12 h.** The chest shows "12 h 00 m" and stops; a return summary lists gold, essence, gear and shards. No "collect every 2 hours" pressure.
- **No energy.** Stages can be retried; first clears give big rewards, repeat clears give gear/XP at a lower rate.
- **No premium currency.** Summon currency is earned; pity is visible; no limited banners in v1.
- **No daily streak punishment.** The 7-day journey gives cosmetic/functional rewards but does not reset to zero on a missed day.
- **Soft walls, not hard gates.** A stage can be attempted under-power; the preview says "recommended power", not "locked".

## Pacing target for one week

| When | Camp level | Heroes owned | Content | Summons |
|---|---|---|---|---|
| First 30 min | 1–3 | 4 (starter) | Chapter 1, stages 1–6 | 0–1 |
| End of day 1 | 5 | 6 | Chapter 1, stage 12 (boss) | 1–2 |
| Day 3 | 10 | 8 | Chapter 2, mid | 3–5 |
| Day 5 | 13 | 10 | Chapter 3, early | 6–8 |
| Day 7 | 15–18 | 12 | Chapter 3 boss, tower 20+, world boss | 8–10 |

These are targets, not formulas. They must be checked with a **balance simulation** (D-11) before content is written.

## Formulas to test (assumptions)

- Stat growth per camp level: **+8–12%** of base.
- Star bonus: **+15–20%** per star, multiplicative on base stats; passive at 3 and 5.
- Gear: main stat scales with gear tier; set bonus **+8–12%** to one stat; +1…+5 each **+10%** of the gear's main stat.
- Stage power requirement: **×1.12–1.18 per stage**, with a boss spike of **×1.35**.
- Idle rate: **stage index × a constant**, so the highest stage matters; cap at 12 h.
- Summon pity: **10 pulls → Rare+**, **50 → Epic**; duplicate → shards at 20% of star cost.

These numbers are placeholders; the simulation decides.

## Risks

- **Inflation / trivialization.** If idle income is too generous, the player out-levels the content and the week collapses into one day.
- **Wall frustration.** Without IAP, a hard wall has no shortcut; every wall must offer a gear/tower/daily path.
- **Summon frustration.** A no-IAP gacha can still feel bad; pity must be visible and duplicates must always be useful.
- **Too few axes.** Three axes may feel shallow to a Summoners War fan; the depth must come from **team composition, speed order and gear sets**, not from more menus.
- **Too many axes.** Adding a fourth or fifth system for "depth" is how the genre becomes a chore.

## Open questions for D-06/D-07

- Shared camp level vs individual hero levels: does sharing kill the attachment?
- Stars from duplicates only, or also from story/daily shards?
- Gear: fixed substats (calm) vs random substats (depth)? Recommend fixed for v1, random later.
- Should the camp produce resources offline, or only the chest? Two idle sources may be one too many.
