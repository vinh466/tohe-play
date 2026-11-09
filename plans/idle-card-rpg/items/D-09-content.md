# D-09 — Content: auto-advance stages, regions, bosses (decided)

**Status:** decided — owner chose **3 regions × 12 stages** on 2026-11-09; the exact tuning is D-11 · **Kind:** decision · **Blocked by:** D-04, D-05, D-06

## Decisions (owner's words)

> "Auto-advance + farm (Recommended)"

> "Thêm nội dung" (4 regions × 12, then 20 heroes/20 enemies/4 bosses/2 events)

- The board **auto-advances** through stages: wave → wave → stage clear → next stage, until a loss.
- On a loss, the company **farms the highest cleared stage**; the player can retry the wall or open a **stage picker** to farm elsewhere.
- No energy; no manual stage selection required for normal progress.
- **4 regions × 12 stages = 48 stages**; 4 region bosses.
- **Tower**: 40 floors at launch, scaling.
- **Daily expedition**: one rotating resource dungeon per day.
- **World boss**: weekly async boss; local damage record in v1.
- **One 7-day Khởi Hành event** and **one weekly Thử Thách Đường Mây**; no live-ops calendar.
- The stage strip at the top is the road: `Vùng 1 · 3/12`.
- **Content duration target**: ~2 weeks at 2–3 short sessions a day.

## Content shape (decided)

| Piece | v1 | Why |
|---|---|---|
| **Regions** | 4 regions, 12 stages each (48 stages) | ~1.5 weeks of progression at 2–3 short sessions a day |
| **Waves** | 2–3 waves per stage; the last wave may be elite | Keeps a stage 20–40 s; auto-advance has a rhythm |
| **Bosses** | Every 4th stage elite; region end boss (4 bosses) | A spike and a reward; a reason to change the team |
| **Stage picker** | A sheet from the top strip; choose any cleared stage to farm | The player can target gear/element drops |
| **Tower** | A landmark on the road; 40 floors at launch, scaling | A second progression path when the road walls |
| **Daily expedition** | One rotating resource dungeon per day | A short daily reason to log in |
| **World boss** | A weekly async boss; damage record, local in v1 | A long-term goal without PvP |
| **Codex** | 20 hero / 20 enemy / 4 region entries; 10 bond pairs | Collection content that reuses battle art |
| **Events** | Khởi Hành (7 days) + Thử Thách Đường Mây (weekly challenge) | A launch arc and a rotating challenge, not a live-ops calendar |

## Open (implementation details, not decisions)

- Exact stage count per region is 12; boss cadence every 4th/5th is a tuning detail.
- Whether a stage has a fixed enemy composition or a small pool per stage.
- Whether the tower is a separate mode or a "landmark" on the road.
- The stage schema (D-11): `region → stage → waves → enemies → rewards`.
- Exact tower floors, world boss cadence, and daily rotation: D-11/D-10.

## What it changes

- **D-07**: loot tables per stage/region; offline farm uses the highest cleared stage.
- **D-10**: daily expedition and world boss are daily/weekly anchors.
- **D-11**: content is data-driven; a stage is a record, not code.
- **D-12**: the board needs a stage strip, a stage picker sheet, a loss/wall card.
- **D-16**: 3 regions × 12 stages + 3 bosses + tower + expedition + world boss is the v1 content budget.

## Evidence

- Owner's words, 2026-11-09.
- [R-06 — Main-screen auto-battler UX](../research/R-06-main-screen-ux.md): auto-advance, stop/farm, stage strip.
- [R-01 — Genre landscape](../research/R-01-genre.md): AFK campaign walls, Legend of Mushroom waves.
- [R-02 — Progression & economy](../research/R-02-progression-economy.md): one-week pacing.

## Discussion

**owner (2026-11-09):** chose auto-advance + farm, then 3 regions × 12, then **"Thêm nội dung"** — revised to **4 regions × 12**, 4 bosses, **20 heroes / 20 enemies**, 40 tower floors and **2 events**.

**agent (2026-11-09):** recorded. The scope grew from 36 to 48 stages and from 16 to 20 heroes; the same structure scales. The cost is more art (20 heroes/20 enemies/4 bosses/4 backdrops), more balance and a longer build; the simulation and content tests become the gate. The exact roster (20/20/4) is a proposal the owner can adjust before art lock; the second event is the first cut if time slips.
