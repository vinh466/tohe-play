# Vườn Rau (`vuon-rau`) — spec (vertical slice)

A tiny farm: till a plot, plant seeds, water them, harvest, sell at the stall, buy more seeds. Crops grow in real time,
also while the game is closed. Calm, no way to lose, for ages 5 and up on a phone held either way or a desktop window.

This is the **pilot of the Asset Studio** (plans/asset-studio V1–V2): a small slice, built only from what the platform
now offers — art from an approved Studio pack (ADR 0051, 0053), content as data, the layout helpers — so it proves the
road from an asset pack to a game on players' phones. It is not the whole farm game of the backlog; that grows from it.

## World

- **One map, 16 × 12 tiles of 16 px**, drawn with the Studio pack `farm-tiny` (Kenney *Tiny Farm*, CC0, imported with
  `tohe-studio`; 16 × 16 tiles, checked on 2026-10-24): grass, a field of **4 × 3 plots** in the middle — three beds of
  four with a path in front of each — dirt paths, pines and sunflowers, the barn, a water trough, a few hens, and the
  **seed stall** (crates) at the path's end. The map is the game's content (`src/content/map.ts`), not an asset.
  *Built (V2):* the pack has no fence, so weeds mark the plots not dug yet; the game loads one file of the pack, its
  tileset, and draws every tile as a frame of it.
- **The farmer** (the pack's farmer, one front-facing sprite: it bobs as it walks and faces left or right by flipping)
  walks where the player taps, along the paths and grass (A* on the tile grid), then acts on the tile.
- The camera fits the map to the world view (`fitWorld`, `contain`); pixels stay crisp (whole-number zoom). Upright on a
  phone that makes a tile about 21 CSS px, so a tap takes the plot, crate or Cô Ba nearest the finger within 0.85 tile
  (`src/targets.ts`).

## A move

Tap a plot; the farmer walks there and does what the plot needs next:

| Plot | Tap does |
| --- | --- |
| Grass | Till it (the field's 12 plots start as grass) |
| Tilled | Opens the seed picker: plant the chosen seed if the player has one |
| Planted, needs water | Water it |
| Ripe | Harvest: the crop goes to the basket |

- **Water** is needed once per growth stage. A dry crop **waits** — it never dies (no failure for young children).
- Tap the **stall**: sell everything in the basket, and buy seeds (a sheet with the three seeds, their price and growing
  time).
- Long-press a plot: what grows there and how long until it is ripe.

## Crops (content, `src/content/crops.ts`, `defineCatalog`)

Three of the crops the pack draws, each with its growth stages (the pack draws wheat in three; its first stage is the
pack's seedling):

| Crop | Seed | Sells for | Stages | Time to ripe |
| --- | --- | --- | --- | --- |
| Cà rốt | 2 xu | 5 xu | 3 | 3 minutes |
| Cà chua | 5 xu | 14 xu | 3 | 15 minutes |
| Lúa mì | 8 xu | 25 xu | 4 | 60 minutes |

- Start: **10 xu** and 3 carrot seeds. Coins are play money only — nothing to buy with real money, ever.
- Growth follows the clock (`Date.now` when planted and watered, kept in the save); a stage passes only once watered.
  Changing the device's clock can speed crops up; for a game without scores or boards this does not matter.

## The stall keeper

**Cô Ba**, standing at the stall (the pack's second person sprite), says one short line when tapped, from a small list that changes with
the time of day and what the player has done (`src/content/lines.ts`). No quests in this slice.

## Day and night

The world's light follows the **device's local time** — morning, day, evening, night — as a soft tint over the map.
It changes nothing in play.

## Screens

- **Menu stage** (the kit's shell, ADR 0020): title, Chơi, Cách chơi, ⚙️ (sound), Ghi công (the pack's credits, shown
  by the kit, ADR 0053), Về Tò He.
- **Play stage**: the world, and a panel — coins, the basket, the selected seed — at the **bottom in portrait** and
  **at the right in landscape or on a desktop** (`onLayout` + `splitLayout`), inside the safe area.
- **How to play**: four pictures — tap to till, plant, water, harvest and sell.

## Feel (juice), in tiers

1. Every action: a small bounce of the plot, a puff of soil or a splash of water.
2. Harvest: the crop pops into the basket with a floating "+1".
3. Selling: coins fly to the counter. A first harvest of a new crop: a short confetti.

## Themes

**One look** (`themes: ["light"]`): the pixel-art world has its own colours, and its day and night come from the
clock, not from the hub's theme. The panel and the kit's screens use the design tokens.

## Contract usage

| | Use |
| --- | --- |
| `capabilities` | `save`, `shell`. No `scores`: nothing to compete on, so the clock may be anything. |
| `orientation` | `any`: conformance plays it upright, sideways and in a desktop window (ADR 0050). |
| `assets` | `farm-tiny` (version as approved), `delivery: "bundle"` (ADR 0053); loaded with `loadPack`. |
| `save` | After every action: `{ v, coins, basket, seeds, plots[12]: { state, crop?, plantedAt?, wateredStage? }, seenHowTo }` — a few kB, far under 64 KB. |
| settings | Respects `muted`. |

## Invariants (checked by the random-play bot)

- Coins never go below zero; a purchase needs enough coins.
- A plot holds at most one crop; a crop's stage never goes back as time passes.
- A crop ripens only through its stages, each one watered.
- Harvest happens only when ripe and moves exactly one crop to the basket.
- A save restores the same farm; replaying the same actions at the same times gives the same result.

## Measured in V2 (the pilot's point)

On a Samsung A55 and an iPhone: the build's size, start-up time, frame times (telemetry, ADR 0015) and the save's size —
reported with a line for the owner to re-check on production.

## Decided with the owner

The owner approved the spec and the five proposals below as they stand (2026-10-24: "spec ổn, chốt theo đề xuất").

1. The three crops, their prices and growing times (above).
2. Growth in real time while closed, and the clock left uncheckable (no scores).
3. Cô Ba's name and one standing NPC instead of a walking one.
4. Day and night from the device's clock, with no effect on play.
5. One look (no dark theme) for the pixel world.

## Technology

Phaser 4 + `@tohe/game-kit` (shell, `loadPack`, layout helpers, `defineCatalog`), pure logic in `src/logic.ts` taking
the time as an argument (no `Date.now` inside) and emitting events the view animates, like `games/merge-block`.
