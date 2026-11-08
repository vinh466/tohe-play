# Brief — Lấp Ô: một lõi yên, một hành trình dài

Status: **draft** — the owner confirms it, and the plan leaves *Frame* when they do.

## Why

Lấp Ô is the next game in the backlog. The current spec is a solid, calm 8 × 8 block puzzle, but it is only an
endless run: one board, one score, one end card. The owner wants more — a core mechanic with depth, a long
progression, and a UI/UX that makes people want to come back, **without** ads, purchases, timers, energy or pressure.

The genre is proven (Block Blast, 1010!, Woodoku), but most of its retention comes from ads, events and FOMO. Tò He
can offer the calm version: a pure puzzle that is easy to start, has a long journey for mastery, and respects the
player.

## The owner's words (2026-11-08)

> "plan Game Lấp Ô đi, nhưng bạn hãy dive research, brainstorm thêm trên các sản phẩm đã có để tạo ra game có cơ
> chế hay, tiến trình dài, UIUX phù hợp hút user nha"

Interpretation: research the genre; find the mechanics that make it good; design a long progression and a UI/UX
that attracts players, while keeping Tò He's rules.

## Constraints in force

- Tò He vision: no ads, no IAP, no tracking, no pressure, no dark patterns; calm and family-friendly; the shelf is
  16+ but children play through a parent's account.
- Game Contract: no network outside the game folder, no own storage, save ≤ 64 KB, CSP, light/dark, vi/en,
  telemetry technical only.
- 8 × 8 on a phone, portrait first; tap-to-place is mandatory (WCAG 2.5.7); drag is optional.
- Use `@tohe/game-kit` and Phaser 4; size budget ~2.5 MB; draw textures, no asset pack required for MVP.
- A run should be 1–5 minutes; a journey level 1–3 minutes; the game must resume exactly.
- The shell has no free screen hook today; a journey/level map may need a kit enhancement.
- `session.seed` is a daily seed (`YYYYMMDD`); endless must not replay the same board on "Chơi lại".
- Public pages and conformance are part of done.

## Done when

- The plan is decided: core loop, progression, UI, art, scope.
- `games/fill-blocks/SPEC.md` is rewritten in English and approved.
- MVP passes `pnpm verify`, conformance, and plays on a phone in light/dark, portrait and desktop.
- The public pages `/games/fill-blocks/` and `/en/games/fill-blocks/` exist.
- UAT and production run it; the owner has played it.
- The owner can point to a long-term goal and a reason to return that does not rely on pressure.

## Not this plan

- Online rooms/PvP, real-time multiplayer.
- A level editor or user-generated content.
- Ads, IAP, currency, energy, loot boxes, battle pass, punishing streaks, countdowns.
- A full 3D or a new art style; board skins use the paper/ink language.
- Platform-wide daily leaderboards in the first release (PB-06 later).
- A new game engine; Phaser + kit is the default.

## Questions for the owner

1. Two layers (endless + journey) + daily + mastery — right direction? [D-03](items/D-03-long-progression.md)
2. Age: keep `minAge: 3` with assists, or set 6+ for the journey? [D-01](items/D-01-positioning-and-age.md)
3. Combo: soft decay (recommended) or reset on a non-clear? [D-02](items/D-02-core-loop.md)
4. Assists: rescue, undo, hint — which belong in the core? [D-02](items/D-02-core-loop.md)
5. MVP journey: 18 levels (3 chapters) or 36 (6 chapters)? [D-04](items/D-04-journey-content.md)
6. Daily: local-first (recommended) or wait for a platform daily board? [D-05](items/D-05-daily-challenge.md)
7. May the kit gain a generic `screens` API for journey/stats/achievements? [D-06](items/D-06-ui-and-shell.md)
8. Palette: 8 colours + shape identity (recommended) or one colour per shape? [D-07](items/D-07-art-and-skins.md)
9. What ships first: core + endless, or core + endless + journey? [D-08](items/D-08-scope-and-phasing.md)
