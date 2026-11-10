# Vân Du Ký (`van-du-ky`) — spec

> **Status: v1.1.1 combat-feedback RC (2026-11-10); v1.1.0 is live in production.** The owner confirmed the plan and brief
> on 2026-11-09 ("ok quyết định cũng đủ r, giờ sựng spec, làm core nền tảng cho chắc chắn...") and the hex-board direction
> on 2026-11-10 ("hợp lý, chốt mạnh như v làm chuẩn đi"). This spec is the source of truth for the game. It follows
> `plans/idle-card-rpg/PLAN.md`; where this page and the plan disagree, the plan's decisions win until the owner changes them.

Vân Du Ký is a phone-first idle card RPG. A company of guardians walks a long road; the **battle board is the app** —
there is no home. The player watches the company auto-advance through waves and grows it through company level, stars
and gear. No ads, no purchases, no energy, no punishing streaks.

## Board and formation

- **6 heroes vs 6 enemies** on a **6 × 4 flat-top honeycomb**: three ranks (front, mid, back) × four lanes = **12 cells
  per side**, six deployed and six open. The open cells are formation space; they never collapse.
- The board is **DOM/CSS**, not a canvas engine: 24 hexes, a portrait, HP bar, element gem and charge pips per card, and
  a small effect layer. No names on the board; tap a card for its sheet. The build is ~330 KB instead of 1.4 MB of
  Phaser.
- The stage is a **column**: HUD (menu, stage/level, gold and essence, six-portrait turn rail, wave and region
  progress), the hex board, a **deck** (Đường đi: road + three-line feed; Dự bị: 12-cell formation), a control bar and
  a five-item dock. The deck shrinks to one feed line on a 320×568 phone; nothing overlaps the board.
- **Ranks** (core `Row`): **front** +20% DEF, +10% HP and draws single-target melee; **mid** +10% ATK, +5% SPD;
  **back** +15% ATK. **Lanes** (core `Column` 0–3) are placement today; lane bonuses are the next cheap step.
- **Terrain**: two marked cells per side (e.g. +ATK, +DEF). A unit standing on a mark gets that small bonus; the mark
  stays visible when the cell is open, so formation is a choice.
- A dead unit leaves an **empty cell**; ranks and lanes never collapse. Position stays meaningful.
- A boss is **one gold-rimmed hex with a crown**. A two-cell boss is later.
- The player arranges the team in the **formation sheet** (12 cells, at most six filled); the board is for watching and
  tapping, not dragging.
- The enemy formation is fixed per stage (or per wave); the stage preview shows it before the fight.

## A battle

1. A stage has **1–3 waves**; each wave is up to a 6v6 formation. The last wave may be an elite or the region boss.
2. **Round-based.** Each round every living unit acts once, in **SPD order**, highest first. Ties go to the unit with
   the lower stable index (heroes before enemies, then slot order). No random speed variance.
3. **Normal attack is automatic and auto-cast is always on.** A unit's **active skill** charges over turns and casts
   when ready. There is no `Tự đi` toggle; `Dừng` pauses the board. The player can still tap any card to read its sheet.
4. **Targeting**: default the lowest-HP enemy; a taunt/front-row rule may override. The player may tap an enemy to
   focus; a row-target skill may choose front/mid/back.
5. **Skills**: each hero has one basic, one active and one passive. The active has a charge (turns), a target rule and
   an effect; the passive unlocks at ★3 or ★5. Enemy skills use the same shape.
6. **Damage**:
   - `raw = ATK × power` (power from the skill, e.g. 1.0 basic, 1.8 active);
   - element multiplier: 1.25 strong, 1.0 neutral, 0.8 weak;
   - crit: `CRIT%` chance, ×1.5;
   - `damage = max(1, round(raw × 100 / (100 + DEF)))`;
   - shields absorb before HP; healing restores HP up to max.
7. **Status**: stun (skips turns), silence (no active), burn/poison (damage at round end), shield, atk/def/spd buffs.
   Durations tick at round end. Bosses may be immune to control.
8. **Between waves**: living heroes heal **15%** of max HP; dead heroes stay dead. A wave ends when all its enemies
   die. The stage ends when all waves are cleared (win) or all heroes die (loss).
9. **Round cap**: 30 rounds; at the cap the stage is a loss.
10. **Speed**: **×1 default**, ×2, ×5, ×10. ×1 is deliberately readable: wind-up, streak, impact, hit-stop and recovery
    are all visible. **Dừng**: pauses the board and the auto-advance. **Reduced motion**: no shake, no sparks or
    projectiles, shorter flashes.

## Auto-advance and farming

- On a win there is **no blocking popup**: a clear ribbon enters the feed, the road marker moves, and the next stage
  loads after about **0.8 s**.
- On a loss, a **small popup** shows the wave and a countdown; the board automatically rewinds to the **start of the
  current wave** (wave 1 → the stage start, full team HP). The loss pays **basic gold only** — no loot, first-clear,
  gear or XP. After **one auto retry**, a second loss opens the **wall panel** in the deck with **Đổi đội**, **Nâng cấp**
  and **Đánh lại**. The wall does not move the road marker.
- Replaying a **cleared** stage pays **a little gold only**. Winning a **new** stage pays the normal loot and the
  first-clear bonus; a retry win on a new stage is a new clear and pays normally.
- The **stage picker** lets the player farm any cleared stage; the default is auto-advance/farm highest.
- No energy; retries are free. A stage can be attempted under the recommended power; the preview warns, it does not
  lock.

## Growth

| Axis | Range | Effect | Cost |
|---|---|---|---|
| **Company level** | 1–20 | +8–12% base stats per level; raises all heroes; unlocks stages/gear tiers | XP from stages/offline |
| **Stars** | 1–5 per hero | +15–20% stats per star; passive at ★3/★5 | Hero shards |
| **Gear** | 4 slots, +0…+5 | Main stat + 2-piece set; +10% of main stat per plus | Gold + drops |

- All heroes share the company level; there is no individual hero level.
- **Gear slots**: weapon, armor, charm, relic. Each has a main stat; 2-piece sets give a bonus. Substats are fixed in
  v1; no rerolls.
- **Power** is a derived score from HP/ATK/DEF/SPD/CRIT; the stage preview compares it with the recommended power.
- No prestige/rebirth, no skill books, no runes/furniture/mounts in v1.

## Elements, roles, rarity

- **Elements**: Ember, Tide, Stone, Gale. Ember > Gale > Stone > Tide > Ember; 1.25× / 1.0× / 0.8×. Show an icon and a
  shape, never colour alone.
- **Roles**: Vanguard (tank), Blade (DPS), Seer (support/heal), Binder (control/debuff).
- **Rarity**: Common, Rare, Epic. Rarity sets the base stat budget and the star ceiling (all can reach ★5).
- **Bonds**: one bond pair per hero; deployed together gives a small bonus; the codex tells the story.

## Content

- **4 regions × 12 stages = 48**, 4 region bosses. Stages 4, 8 and 12 of a region are elite/boss spikes.
- **20 heroes**, **20 enemy types**, **4 bosses**, **4 region backdrops**.
- **Tower**: 40 floors at launch, scaling; each floor is a 6v6 formation with a modifier.
- **Daily expedition**: one rotating resource dungeon per day.
- **World boss**: one weekly async boss; the player's best damage is a local record in v1.
- **Events**: **Khởi Hành** (a 7-day launch journey of tasks/rewards) and **Thử Thách Đường Mây** (a weekly challenge
  with 2–3 modifiers and a local record).
- **Codex**: 20 hero, 20 enemy, 4 region entries; 10 bond pairs; company rank; local records.
- Content lives in `src/content/` as typed catalogs; the balance sim plays all 48 stages before art lock.

## Economy

| Currency | Source | Sink |
|---|---|---|
| Gold | stage clears, offline, daily | hero/gear upgrades |
| Essence | stage clears, offline, daily, tower | star-ups |
| Memory shards | stage clears, daily, tower, duplicates | summon |

- **Summon**: 100 shards/pull, 900/10; **pity 10 → Rare+**, **50 → Epic**; duplicates → shards; no limited banners,
  no money.
- **Offline**: the company fights the highest cleared stage while the app is closed; **cap 12 h**; on return a card
  lists time, waves, gold/essence/shards/gear; the rate is slower than active play.
- **Daily**: 3 tasks (clear 3 stages, upgrade gear once, summon once), 1 expedition, 1 boss; no energy, no streak
  punishment; the 7-day journey does not reset to zero on a missed day.
- **No premium currency, no paid pull, no ads.**

## Save

- One JSON envelope per profile, versioned, **≤ 256 KB** (`saveBudgetKb` in `game.json`).
- Shape (v1):
  - `v`, `company`, `currencies`, `roster`, `gear`, `progress`, `daily`, `event`, `summon`, `settings`, `offline`,
    `tutorial`.
  - `roster[heroId] = { star, shards, gear: { weapon?, armor?, charm?, relic? } }`.
  - `gear[id] = { defId, plus }`; gear inventory capped at 200; low-rarity overflow is auto-dismantled with a notice.
  - `progress = { region, stage, highest, tower, records }`.
  - `daily = { date, tasks, expedition, boss, journeyDay }`.
  - `summon = { pityRare, pityEpic, lastFree }`.
- Migrations are pure functions in `save.ts`; a save from a newer version is refused with a clear message, never
  silently dropped.
- Save on: stage clear, wave result if the player leaves, upgrade, star, gear, summon, daily claim, building? (no
  building), settings, app pause, and every ~30 s during a session.
- The hub stores the save; the game never uses `localStorage`/IndexedDB/cookies.

## Screens

There is no home. The board is the app.

| Screen | What it does |
|---|---|
| **Board** | 6v6 on 12 cells/side, HUD (stage/level, gold/essence, turn rail, wave), hex cards, effects, speed/stop, Nâng cấp, dock |
| **Deck** | Đường đi (12-node road, three-line feed) and Dự bị (12-cell formation); loss popup and wall |
| **Formation sheet** | 12 cells (3 ranks × 4 lanes), at most six heroes, row/terrain bonuses, roster, tap, save |
| **Hero list/detail** | stats, stars, skills, gear, bond, upgrade |
| **Gear sheet** | inventory, equip/compare, upgrade, sets |
| **Summon sheet** | portal, pity, ×1/×10, results, duplicates → shards |
| **Codex** | heroes/enemies/regions, bonds, records |
| **Daily** | 3 tasks, expedition, boss, 7-day journey |
| **Stage picker** | regions/stages, recommended power, rewards, farm |
| **Offline card** | time away, loot, Nhận |
| **Settings/credits** | sound, reduced motion, language, credits |
| **How to play** | first-time, one card, one screen |

- Bottom dock: **Đội · Trang bị · Triệu hồi · Sổ tay · Hôm nay**. A sheet pauses the battle; closing resumes.
- One-hand: primary actions in the bottom 40%; touch targets ≥44 px; safe areas respected.
- Empty/loading/offline states: a quiet card, never a dead screen.

## Look and feel

- **Pixel art**, **card-on-board**, **dark-first**. `themes: ["dark"]`; the game keeps its own look.
- Board card portrait 32×32; hero detail 64×64; 3 rarity frames; element gem, role icon, star pips.
- Battle: the attacker leans in, the target flinches, a flash and element ring land, 6–10 sparks fly and a damage
  number floats; HP has a ghost bar. Crits add a gold number, a 2 px shake and a haptic; active skills add a short
  `CHIÊU · …` banner and a larger hit-stop. Heal, shield, burn, stun and death have their own small language.
- FX are **CSS/WAAPI** on `transform`/`opacity`, with pooled numbers (16), capped bursts (3) and cached cell centres.
  No engine, no canvas, no per-frame game loop. A hit is a coloured streak, a slash, an element ring, a flash, sparks
  and a number; ×1 is the default, ×2/×5/×10 shorten every beat. Reduced motion drops sparks, projectiles and shake. A
  tiny canvas overlay is the escape hatch if a future effect needs hundreds of particles.
- **Portraits**: 44 original 32×32 pixel portraits generated by `art/generate-portraits.py` and bundled under
  `public/portraits/`; `image-rendering: pixelated` at 24–64 CSS px.
- **Audio: SFX only** (D-15): hit, crit, block, death, skill, ultimate, summon, level-up, star-up, UI, boss telegraph,
  victory/defeat. No music. Haptics on crit/death/ultimate; respect reduced motion and the mute setting.
- UI text in Be Vietnam Pro (Vietnamese diacritics); a pixel font only for numbers/Latin titles, never body text.

## Invariants (the bot and tests check)

- The same seed + same inputs produce the same battle.
- Turn order is SPD desc, stable tie-break; no unit acts twice in a round; dead units never act.
- Damage is an integer ≥1; HP stays in `[0, max]`; shields never go negative.
- A wave ends only when all its enemies are dead; a stage only when all waves are cleared.
- Auto-advance stops on a loss; farming uses the highest cleared stage; no energy.
- Summon pity: a 10th pull without a Rare gives a Rare+; a 50th without an Epic gives an Epic.
- Offline: never negative, capped at 12 h, never grants a stage the player has not cleared.
- Save → restore is identical; a migration never loses a hero, gear or currency.
- Content references resolve; every stage is winnable at the intended power and not trivial.
- No request outside the game's folder; no `localStorage`/IndexedDB/cookies.

## Content data

- `src/content/heroes.ts`, `skills.ts`, `enemies.ts`, `bonds.ts`, `gear.ts`, `stages.ts` (regions + 48 stages),
  `events.ts` (expedition, tower, world boss, challenge).
- `defineCatalog` + `checkReferences`; Zod schemas in tests; the bundle never validates at run time.
- A stage record: `id`, `region`, `index`, `waves[]`, `recommendedPower`, `firstClear`, `loot`, `modifiers?`.
- A wave record: `enemies[]` (id, row, column, level), `elite?`, `boss?`.
- The balance sim (Node) imports the same pure logic and catalogs; it fails on an unwinnable/trivial stage.

## Not in v1

- PvP, guild, chat, social feed, public leaderboards/ranked.
- Content packs/remote content (P1), push, live-ops calendar.
- Music, light theme, native app, 3D, base/camp/home.
- Real-money anything.

## Locked in v1.0.1

- Roster: 20 heroes, 20 enemies, 4 bosses, 10 bond pairs; 4 regions × 12 stages (48), 4 region bosses.
- Growth: company 1–20, stars 1–5, gear +0–5 in 4 slots; bond pairs give +6% HP/ATK when deployed together.
- Events: Khởi Hành (7 days, never resets to zero) and Thử Thách Đường Mây (weekly, fewest rounds).
- Tower: 40 floors; daily expedition: 3 waves; world boss: one weekly boss, local damage record.
- Save v2: a v1 save migrates by filling the daily/weekly blocks; nothing is lost.
- Economy: gold buys gear pluses, essence buys stars, shards summon; the HUD shows gold and essence, summon shows shards.

## Open (P1 tuning, not v1 decisions)

- pixelfx sprite sheets and on-demand asset delivery.
- More bond stories, region lore and the central mystery.
- A second expedition rotation and harder challenge modifiers. A balance pass after real play.
