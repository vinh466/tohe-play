# D-07 — Art, palette and skins

**Status:** proposed · **Kind:** decision · **Blocked by:** D-01

## Question

How does Lấp Ô look, and how do 20+ shapes stay readable in both themes and for colour-blind players?

## Options

### A — 8 hues + shape identity + 6 board skins (recommended)

- **Pieces**: 8 hues from the paper/ink palette; each hue is used by several shapes. The **shape** is the primary
  identity; colour is secondary. A "Dễ phân biệt" palette (Okabe–Ito) is an option; every piece is at least
  4.5:1 on its board in both themes.
- **Board skins**: Giấy, Mực, Gấc, Nghệ, Lá, Đêm. They change the board frame/background, not the piece palette.
  Unlocked by journey stars and mastery ranks; no purchase.
- **Look**: paper and ink; cream board in light, warm charcoal in dark; gấc red for actions, turmeric/leaf for
  attention. Drawn with Phaser textures; no asset pack for MVP.
- **UI**: design tokens; icon + word; every screen works in light and dark.

**Cost:** a palette test (contrast and distance) and six skin variants; no asset pack.

### B — One colour per shape (current spec)

- 20+ colours; each shape is instantly recognisable by colour, but the board is noisy, colour-blind players lose
  the channel, and two similar hues can confuse.
- More work to keep contrast; no real benefit over shape identity.

### C — Illustrated asset pack

- Beautiful but expensive and slower; the game does not need it, and the kit's drawn textures are crisp and
  tiny. A pack can come later.

## Recommendation

**A**. Shape is the stable identity; 8 hues keep the board calm; skins give expression without changing the
puzzle's readability. The "Dễ phân biệt" palette is a setting, not a skin.

## Palette and accessibility

- Every piece has a distinct shape; no two shapes rely on colour alone.
- Text 4.5:1; UI/non-text 3:1; test both themes.
- A colour-blind palette uses the Okabe–Ito hues; a symbol/pattern can be added to the "unusable" state.
- Reduced motion: no confetti; clears snap with a short flash.
- The board skin must not reduce contrast; test each skin with the piece palette.

## Evidence

- Colour is not a channel alone; 1 in 12 men has CVD: [R-02](../research/R-02-ux-and-retention.md).
- Paper/ink brand and tokens: ADR 0057, `docs/architecture/theming.md`, `packages/design-tokens`.
- Draw textures, no asset pack: [R-03](../research/R-03-platform-and-reuse.md).

## Discussion

**agent (2026-11-08):** recommend A. The current spec's "each shape has its own colour" is charming on paper but
noisy on an 8 × 8 board; 8 hues + shape identity is the readable version. The owner should see a palette
prototype before the spec is final.
