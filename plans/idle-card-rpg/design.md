# Design — RPG thẻ bài treo máy: first picture (v0, proposed)

This page **composes** the items into one picture. It decides nothing: every claim points at the item that decides it, and *(proposed)* marks an item not yet `decided`. Date: 2026-11-09.

## Short answer: how complete is it?

**Grounded:** the genre, the platform limits, the owner's five answers, and the battle/progression budget. **Not decided:** the world hook (D-01), the platform approach (D-02), the battle model (D-04), and every system that follows them. Everything below D-04 is a **working proposal** to make the discussion concrete, not a decision.

## 1. The picture

```mermaid
flowchart LR
  camp["Camp (home)<br/>idle chest · 3 buildings · team"] --> adventure["Adventure<br/>chapter map"]
  adventure --> stage["Stage preview<br/>enemy cards · recommended power"]
  stage --> formation["Formation<br/>4 heroes, 2×2"]
  formation --> battle["Battle<br/>4v4 · speed order · manual ultimates"]
  battle --> rewards["Rewards<br/>gold · essence · gear · shards"]
  rewards --> camp
  camp --> heroes["Heroes<br/>camp level · star · gear"]
  heroes --> formation
  camp --> summon["Summon<br/>earned currency · visible pity"]
  summon --> heroes
  camp --> daily["Daily<br/>3 tasks · expedition · world boss"]
  daily --> rewards
  camp --> tower["Tower<br/>endless floors"]
  tower --> rewards
```

## 2. The pieces, the standard behind each, and where each lives

| Piece | Does | Standard / prior art | Lives in | Item |
|---|---|---|---|---|
| **Camp** | Home screen: idle chest, 3 buildings, current team, daily summary | AFK's idle chest + a light base | Play stage, first tab | D-01, D-08 |
| **Adventure** | 3 chapters × 12 stages; each stage a wave/round puzzle | Summoners War scenario, AFK campaign | Play stage, tab 2 | D-09 |
| **Battle** | 4v4, round-based speed order, auto attacks + manual ultimates; 20–40 s | Summoners War + AFK | Phaser scene in play stage | D-04 |
| **Heroes** | Roster, hero detail, star, gear, skills, bonds | Summoners War monsters, AFK heroes | Play stage, tab 3 | D-05, D-06 |
| **Summon** | Earned pulls, visible pity, duplicates → shards | AFK's generous gacha, without money | Play stage, tab 4 | D-07 |
| **Daily** | 3 tasks, 1 expedition, 1 boss; no energy, no streak punishment | AFK's flexible dailies | Camp + a daily screen | D-10 |
| **Tower** | Endless floors, scaling rewards | AFK King's Tower | Adventure sub-screen | D-09 |
| **Codex** | Hero/enemy entries, bonds, achievements, local records | Collection meta | More menu | D-08 |
| **Settings / credits** | Sound, theme, language, asset credits | Game Contract + kit | Menu stage | D-02, D-13 |

## 3. The main flows

### First 10 minutes

1. Title screen ("Làng Mây", *Chơi*) → a short how-to (one card, one screen).
2. Camp: a chest with a small starting gift; a 4-hero starter team; the first stage is one tap away.
3. Stage 1-1: auto-battle with one manual ultimate; win; gold/gear; "Nâng đội" button.
4. Hero screen: level the camp once, equip the first gear, see the power go up.
5. Stage 1-2 → 1-4: the first "recommended power" wall; the game points to gear/star, not a paywall.
6. First summon: enough shards for one pull; a guaranteed Rare; the new hero can join the team.

### A daily return (5–10 min)

1. Camp: collect the 12 h chest; read a one-line "while you were away" summary.
2. Daily: claim 3 tasks (clear 3 stages, upgrade gear once, summon once); collect the expedition.
3. Push 1–3 stages or retry the wall; auto ×3 if farming.
4. Spend gold/essence; upgrade a building; close.

### The first wall (day 2–3)

1. Stage preview says "recommended power 1,450 · your team 1,280".
2. The loss card suggests: "Đổi đội hình", "Nâng gear", "Thử tháp" — three free paths.
3. The player farms the highest cleared stage with auto ×3, upgrades gear, changes the front row, and wins.
4. No energy, no timer, no "watch an ad to continue".

## 4. Still open

- **D-01** — the world hook (Làng Mây vs Đoàn Thám Hiểm vs Đấu Trường Cổ).
- **D-02** — adapt + E-01 vs platform extension.
- **D-04** — round-based vs ATB vs auto-charge.
- **D-05** — 4/5/6 heroes; roles, elements, rarity, gear slots.
- **D-06** — shared camp level vs individual levels; 3 vs 4 axes; no prestige in v1.
- **D-07** — no gacha vs earned gacha vs hybrid; pity; duplicate value.
- **D-08** — no base vs light camp vs full base; codex depth.
- **D-09** — 3 chapters vs endless; which modes; stage schema.
- **D-10** — daily weight; no streak punishment.
- **D-11** — content pipeline and balance simulation.
- **D-12** — 4 tabs vs 5; screen map; wireframes.
- **D-13** — card-on-board vs sprite vs hybrid; dark-first vs both themes.
- **D-14** — name, factions, tone, lore hooks.
- **D-15** — audio/haptics; music or SFX only.
- **D-16** — v1 scope, milestones, what is deliberately out.

## 5. Known risks without an answer yet

| Risk | Where it will be answered |
|---|---|
| Scope creep: the genre pulls toward 8–11 systems | D-16, with a hard v1 list |
| Balance: one week collapses into one day, or walls are too hard | D-06/D-07/D-11, with a simulation |
| Art cost: 12 heroes × 12 frames + 12 enemies + 3 bosses | D-13/D-11, with a frame budget and reuse plan |
| Shell mismatch: a persistent world is not a "run" | D-02/E-01 |
| Phone readability: 4 cards + turn rail + boss bar on 360 px | D-12, with wireframes tested at 360×640 |
| Retention without FOMO: no energy, no streaks, no ads | D-10, with a light daily and a 7-day journey |
| Content cadence: a live game needs new chapters | D-09/D-11, with data-driven content |
| "Calm" vs "deep": the owner wants both | D-01/D-04, via playtest |
