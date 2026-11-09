# D-13 — Art direction: pixel card-on-board, dark-first

**Status:** decided — owner chose **card-on-board** and **dark-first** on 2026-11-09; the detailed art spec is open · **Kind:** decision · **Blocked by:** D-01, D-05, D-12

## Decisions (owner's words)

> "Card-on-board (Recommended)"

> "Dark-first (Recommended)"

- **Card-on-board**: the cards themselves are the units; in battle they lunge, collide, shake, and shatter. Pixel portraits live on the cards. No walk cycles, no full sprite animation for v1.
- **Dark-first**: one dark theme at launch; a light theme is a later addition, not a v1 requirement.
- **Pixel art** remains the style (owner, first round).

## Why card-on-board

- It is the owner's image: characters and monsters are **cards**, and the clash is between cards.
- It is the cheapest way to get a distinctive battle look: card transforms + hit-stop + particles + damage numbers instead of 12-frame character animations.
- It scales to 6 heroes + 6 enemies on a phone: the card frame is the unit, the portrait is the character.
- It leaves the door open for a **hybrid** later (a pixel sprite stepping out of the card) without changing the battle model.

## Why dark-first

- Pixel fantasy reads better with a dark ground and warm highlights; the card frames and damage numbers pop.
- One theme is less UI/contrast work than two; the game can still declare `themes: ["dark"]` in `game.json`.
- Tò He's hub is light/warm, but a game may keep its own look; the title screen and the game's colours are the game's own.
- A light theme can be added later if the family asks for it; it is a palette/contrast pass, not a redesign.

## Proposed art spec (to refine in D-16/D-11)

| Piece | Spec |
|---|---|
| **Card portrait** | 32×32 px on the board; 64×64 px on the hero detail; same pixel grid |
| **Card frame** | 9-slice; 3 rarities (Common/Rare/Epic); element gem, role icon, star pips |
| **Enemy card** | 32×32 portrait; slightly dimmer frame than heroes; boss frame is larger/darker |
| **Palette** | 24–32 colours; one master palette + a region accent; Studio `tohe-pixel` enforces palette/binary alpha |
| **UI font** | Be Vietnam Pro (Vietnamese diacritics); a chunky pixel font only for numbers/Latin titles, never body text |
| **Background** | One region backdrop per region; simple parallax-free layers; dark, low-contrast so cards read |
| **FX** | 40–60 ms hit-stop; 2–4 px shake; float text; element-coloured burst; card death shatter; ultimate cut-in |
| **Card lunge** | 80–120 ms forward, 60 ms back; squash on impact; no character walk |
| **Reduced motion** | Respect `prefers-reduced-motion`: no shake, shorter cut-ins, no particles |
| **Asset packs** | heroes, enemies, ui, fx, backgrounds, audio; pinned in `game.json`; Studio credits |

## What it changes

- **D-12**: the board is a card board; the formation sheet uses the same card art; the 6-hero/3-row density is the main readability risk.
- **D-11**: art pipeline = card portraits + frames + FX + region backdrops; no character walk cycles.
- **D-16**: the art budget is smaller than a sprite-on-board game; more of it goes to card frames, FX and UI.
- **D-15**: sound/haptics should match card impacts (thud, paper shatter, elemental burst).

## Open

- Exact palette and card-frame shapes; a moodboard of 3 directions.
- Portrait resolution: 32×32 vs 48×48; the 6-hero board may force 32×32.
- Whether enemies use the same card frame or a simpler "monster card" treatment.
- Music: one theme + one battle loop, or SFX only.
- Light theme: later or never.

## Evidence

- Owner's words, 2026-11-09.
- [R-03 — Battle, card UX and pixel art](../research/R-03-battle-card-ux.md): card-on-board vs sprite vs hybrid; pixel specs; hit feedback.
- [R-07 — Formation](../research/R-07-formation.md): 3 rows / 6 heroes and the density risk.
- `packages/game-kit/src/phaser/juice.ts` (shake, floatText, burst, squash, pulse).
- `docs/guides/make-assets.md` and the Studio's `tohe-pixel` style.

## Discussion

**owner (2026-11-09):** chose card-on-board and dark-first.

**agent (2026-11-09):** both choices simplify the art budget and sharpen the identity. The risk is density: 12 cards on a 360 px screen, with card frames and damage numbers. The v3 wireframe must prove readability; if it fails, the fallback is 2×2/4 heroes or a zoomed "active row" view, not more art.
