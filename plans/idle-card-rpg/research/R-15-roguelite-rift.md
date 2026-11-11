# R-15 — What the game needs next: a short roguelite run

Date: 2026-11-11 · Status: **implemented** in the v1.2.0 slice

The owner is happy with the hex board, the ×1/×2/×5/×10 pace and the deck. The next gap is not presentation: the
story is a solved auto-battler. The player chooses a formation and gear before a stage, then watches. Replaying a
cleared stage pays gold only, so there is little reason to try a different build.

## What the reference games do

| Product | Pattern worth taking | What does not fit us |
| --- | --- | --- |
| **Slay the Spire** | A short map with battles, an elite, an event and a boss; a card/relic choice after each fight; a run is a build | Deck-building a hand is too far from our auto board |
| **Loop Hero** | Run-only tiles and blessings that change the same battle rules; risk and reward on a small map | Placing tiles every step is too fiddly on a phone |
| **Hades** | A boon choice after each room; the build is the run; meta currency at the end | Action combat and art scale are out of scope |
| **Vampire Survivors** | Stacking, legible upgrades; the next choice is always close | Real-time swarms need an engine and a different game |
| **AFK Arena / Legend of Mushroom** | Formation, factions, idle income, short sessions, clear power growth | Gacha pressure, energy and a hundred systems are not the goal |
| **Archero / Capybara Go** | A run of rooms with a choice after each room; one hand, 3–5 minutes | The run is the whole game; we keep the story road as the home |

The useful common shape is: **a 3–5 minute run, a choice every 1–2 minutes, a build that is visible, and a reward
that feeds the permanent road.**

## Proposal: Dị Bản (the rift)

A new mode beside the story, launched from the stage picker:

```text
Chọn di vật  ->  Cửa vào  ->  Hành lang  ->  Miếu cổ  ->  Thử thách  ->  Vực sâu  ->  Chúa tể
                   ⚔            ⚔            ?            ✦             ⚔            ☠
```

- **Six stops**: three battles, one elite, one event, one boss. About 3–5 minutes at ×1; faster at ×2/×5.
- **One relic at the start** and **one blessing after every stop**. Three options each time; no reroll in v1.
- **Run-only modifiers**: stat boosts, lifesteal, a starting shield, an active ready at the start. The story's
  permanent power is unchanged; the rift is about the build of this run.
- **Rewards per stop** in gold/essence, and a boss bonus in shards. No first-clear or gear: the mode is repeatable
  without becoming the best farm.
- **Loss ends the run** (no story-style auto retry). The rewards already earned stay; the player can start a new rift.
- **No save schema change**: the run lives in the page. Closing the app loses the run, like a short roguelite.

### Why this is the right next step

1. It uses the board, battle core and effects already built. No new art, no new engine.
2. It turns the 12-cell formation and the 4 lanes into a build decision: a glass-cannon blessing makes the back lane
   matter; a shield/lifesteal build makes the front lane matter.
3. It gives a reason to replay: the next run can be a different relic and a different blessing stack.
4. It is short enough for one hand and one sitting, and it does not replace the idle road.

### The first slice (v1.2.0)

- 6 stops, 4 relics, 8 blessings:
  - `+ATK`, `+HP`, `+DEF`, `+SPD`, `+CRIT`, `lifesteal`, `start shield`, `start charged`.
  - Relics: balanced, attack, defense, utility.
- 3 options per choice, no duplicates among owned blessings; if the pool runs out, the run continues with what is
  available.
- The road deck becomes the rift map while the mode is active; the bench stays available.
- Entry in the stage picker under a `Dị Bản` card. A run is launched, not auto-started.
- Rewards per stop: gold/essence; boss adds shards. A clear ribbon in the feed; no story popup.

### Later, if the first slice is fun

- **Lane bonuses** (top CRIT, mid HP, lower ATK, fourth DEF) and **adjacency bonds**; the formation becomes the
  build even in the story.
- **Curses / risk**: a stronger blessing with a drawback; the player chooses.
- **Relic codex**: first-time relic discovery pays a small permanent reward.
- **Daily rift seed**: the same six stops for everyone in the house; the owner can compare builds.
- **Chiêu tab**: the active-skill choice and charge display; the owner already put this after the first playtest.
- **Events** with two-step choices (shrine, merchant, wounded hero) instead of a free blessing.

## Technical shape

- `BattleModifier` in the pure core: stat shares, lifesteal, start shield, start charge. `createBattle` applies them
  to the hero units only; the story passes an empty list, so its balance is unchanged.
- `content/rift.ts`: relic/blessing catalogs, six-node map, deterministic stage generation from a seed, rewards.
- `stage.ts`: a `RiftRun` in memory, the start/reward choice sheets, the map in the road deck, rewards and game-over.
- `ui/sheets.ts`: a reusable locked choice sheet (no close button while the run needs a choice).
- No save version bump; the run is ephemeral. The existing currencies and daily reset are enough.

## Success test

- A new player can start a rift from the stage picker and finish or lose it in one sitting.
- The three choices are understandable without a tutorial; the chosen build shows in the next fight.
- The story, tower, daily, boss and challenge modes still build and pass conformance.
- The build stays small; no new dependency.
