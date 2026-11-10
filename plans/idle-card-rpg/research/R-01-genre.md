# R-01 — Genre landscape & reference teardown

Date: 2026-11-09 · Status: first pass (đủ để chốt D-01/D-04; sẽ bổ sung khi chọn hướng)

Question: các game tham chiếu làm gì, vì sao người chơi ở lại, và bản Tò He nên lấy gì / tránh gì?

## Sources

- Deconstructor of Fun, *AFK Arena — Hail to the New King of RPGs* (2019): https://www.deconstructoroffun.com/blog/2019/6/6/afk-arena-puts-lilith-into-the-billionaire-club
- Florian Jesuha, *Flexible time session design in AFK Arena*, Game Developer (2020): https://www.gamedeveloper.com/design/flexible-time-session-design-in-afk-arena
- Alexandre Macmillan, *Idle mechanics and monetizing progression in AFK Arena* (2019): https://alexandremacmillan.com/2019/06/13/idle-mechanics-and-monetizing-progession-in-afk-arena/
- Deconstructor of Fun, *How Idle Heroes made $100M in a Year* (2018): https://www.deconstructoroffun.com/blog/2018/2/27/u6ap146ff5rkmm7fj1qzuhggp395l4
- Deconstructor of Fun, *The Magic of Legend of Mushroom* (2024): https://www.deconstructoroffun.com/blog/2024/4/15/the-magic-of-legend-of-mushroom
- Troy Dunniway, *Summoners War Breakdown — Part 1* (2017): https://www.linkedin.com/pulse/summoners-war-breakdown-part-1-troy-dunniway
- Epic7x, *Combat Readiness Guide* (2019): https://epic7x.com/combat-readiness-tutorial/
- RPG Fan, *Epic Seven Review*: https://www.rpgfan.com/review/epic-seven/

## The reference table

| Game | Core loop | Battle | Progression depth | Retention hooks | What to take | What to avoid |
|---|---|---|---|---|---|---|
| **AFK Arena** | Clear stages → idle chest → level/ascend team → push further | 5 heroes, auto-battle, manual ultimates optional | Hero level, ascension (dupes), gear, signature item, furniture, resonating crystal | 12 h idle chest, campaign walls, Labyrinth, Tower, guild boss, arena | Idle chest as an appointment; no energy; one-time campaign stages; generous early rewards; roster-wide level sync | Currency sprawl; ascension gate as a wall; VIP/monetization layers |
| **Idle Heroes** | Campaign auto-battle → collect idle rewards → upgrade 6 heroes → push | 6 heroes, turn-based auto-battle, faction auras | Stars (to 10), level, 6 gear slots, skills, monster, guild tech | Daily modes, tower, arena, guild, tavern quests | Character upgrade clarity; faction auras that reward roster breadth; idle rewards inside the core loop | Too many meta systems; star fodder explosion (hundreds of 4★); shard frustration |
| **Summoners War** | Farm runes/essences → build monsters → clear PvE → arena/guild | 4 monsters, turn-based, auto supported | 6 rune slots, sets of 2/4, main/substats, power-ups, awakening, skill-ups | Rune chase, guild, arena, trial of ascension, world boss | Rune/gear depth; 4-unit team; speed and turn order; collection breadth | Rune RNG grind; energy; rune inventory management; PvP pressure |
| **Epic Seven** | Story/PvE farm → gear heroes → arena | 4 heroes, turn-based with Combat Readiness (speed gauge) | 6 gear slots, sets, substats, skill enhancements, awakenings | Story, hunt bosses, arena, guild war | 4-hero readability; speed/CR as a tactical layer; strong skill animations | Gear RNG; huge hero pool; PvP-centric endgame |
| **Legend of Mushroom** | Kill waves → open gear lamps → equip/sell → grow power → harder waves | Auto-battler, one hero + companions | 10 gear slots + 11 verticals (mount, artifact, relic, skills, pals, tech, garden, souls…) | Daily lamp batch, keys, guild, leaderboards, battle passes | Explicit growth goals; gear as a constant drip; visual power fantasy | 11 verticals; 1–2 h daily gear-opening; time gates; FOMO; monetization everywhere |
| **Hero Wars / Evony / MU** | Campaign/auto-farm → upgrade heroes/base → compete | 5 heroes, auto with manual ults; or auto-grind | Many verticals, VIP, gear, stars, titans, base | Events, guild, PvP, leaderboards | Big numbers and clear power spikes; base as a long-term project | Pay-to-win, PvP pressure, timers, events designed to sell |

## What the best ones share

1. **A loop you can explain in one sentence.** Fight → get rewards → make the team stronger → fight further. Every system feeds that sentence.
2. **One simple battle, many team decisions.** The battle itself is easy to watch; the depth is in who you bring, who acts first, and what you save.
3. **A visible wall, then a way around it.** Campaign stages stop you; other modes, gear, stars or idle time give another path. The player always has a next move.
4. **Idle as an appointment, not a substitute.** The chest gives a reason to return; the player still makes the meaningful choices.
5. **Roster breadth is rewarded.** Faction auras, elemental enemies, tower floors and restricted modes make a wide collection useful.
6. **A long, legible upgrade path.** The player can see the next star, the next gear tier, the next skill. The numbers go up in a way they can feel.

## What Tò He must not copy

- **Monetization-shaped walls.** Ascension gates, energy, VIP, battle passes, limited banners. Without IAP, these become pure frustration.
- **System sprawl.** Legend of Mushroom's 11 verticals; AFK's currency soup; Idle Heroes' 10-star fodder. For a 1-week v1, three growth axes is already deep.
- **Time disrespect.** 1–2 hour daily gear-opening loops; FOMO events; daily chores that punish a missed day.
- **PvP as the endgame.** Tò He has no real-time PvP and no monetization; a competitive ladder would need integrity work and a population.
- **Story as a wall.** Long unskippable cutscenes in a game meant for 5-minute sessions.

## Implications for this plan

- The core should be **4 heroes, round-based speed order, auto normal attacks + manual ultimates**. It reads on a phone, can be simulated, and leaves room for team decisions.
- The meta should be **3 growth axes + a light camp**, not 8 verticals. The camp gives the "farm" fantasy and a home screen; the axes give depth.
- The content should be **3 chapters × 12 stages + tower + daily + boss** for v1. That is roughly one week of progression at 2–3 short sessions a day.
- The idle layer should be **one 12 h chest + camp production**, with a clear "while you were away" summary. No energy, no daily lockouts.
- The collection should be **earned, with visible pity**. No limited banners, no paid currency, no duplicate-only walls.

## Assumptions to test

- A 4-hero team is enough collection pressure for a 1-week v1 (AFK uses 5, Summoners War 4, Idle Heroes 6).
- Manual ultimates are worth the UI cost on a small screen; if not, auto-charge with a "hold ultimate" option is enough.
- A light camp can carry the "farm" feeling without becoming a second game.
- One week of content can be produced with 12 heroes, 12 enemies and 3 bosses using pixel art and the Studio pipeline.
