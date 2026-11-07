# D-06 — UI, shell and screens

**Status:** decided — owner approved the recommended option on 2026-11-08 ("ok tốt nha, làm đi") · **Kind:** decision · **Blocked by:** D-02, D-03

## Question

Where do the journey, daily, stats and achievements live, and what does the player see first?

## Options

### A — Extend the kit shell with a generic `screens` API (recommended)

- `createShell` gains `screens`: a list of `{ id, icon, label, render, back }`; the shell owns navigation, focus,
  Back/Escape, theme and the return to the title.
- The title screen gains a second primary card (`Hành trình`) and a progress line (`Chương 2 · 8/18 sao`).
- Journey, Daily, Stats and Achievements are ordinary screens, not overlays over the board.
- Other games can use the same API; it is a platform improvement, not a Lấp Ô hack.

**Cost:** a kit change with tests/docs; an ADR if the public shell API changes. The screen renderer must handle
scroll, safe areas and both themes.

### B — Journey as an overlay inside the play stage

- No kit change; the journey map is a card over the board before a level starts.
- Clunky: the title screen cannot show progress; the board is hidden behind the map; Back semantics are unclear.

### C — Journey in the hub

- A hub page per game with progress; truly platform work, and it breaks the game's self-containment. The hub
  currently shows only best for 3 recent games.

## Recommendation

**A**. The shell is already the home of the title/settings/how-to/leaderboard; a generic screen hook is the
smallest change that keeps games self-contained. Do it once, use it for Journey, Daily, Stats and Achievements.

## Screen sketch

- **Title**: logo, `Chơi tự do`, `Hành trình`, daily card, best/rank, tools.
- **Journey**: vertical paper map; chapters as pages; level stamps with 0–3 stars; locked levels show the reason;
  tapping a level opens a card with goals and `Chơi`; `Tiếp tục` jumps to the next unplayed.
- **Daily**: today's card + calendar of stamps; `Chơi hôm nay` or `Đã đóng dấu`; share result.
- **Stats/Achievements**: totals and a grid of achievement stamps; no notifications.
- **Playing**: board, tray at the bottom, HUD score/best, combo meter, journey goals in the HUD center.
- **End card**: endless (score/best/rank), journey (stars/goals/next), daily (stamp/share).

## UX rules

- Board first; a 3-step interactive first run; the how-to stays available.
- Tap-to-place is mandatory; drag optional; ghost above the finger; 44 px targets.
- Tray at the bottom (thumb zone); test 320/360/390 px; a 5-cell piece may shrink in the tray and grow on pick.
- One-handed, portrait first; light/dark follow the hub; reduced motion; sound/haptics optional.
- Icon + word; menus one level deep; no reading required for a small child.

## Evidence

- The shell has no free screen hook; title/tools are fixed: [R-03](../research/R-03-platform-and-reuse.md).
- Board-first onboarding, tap-to-place, touch targets, one-handed layout:
  [R-02](../research/R-02-ux-and-retention.md).
- Existing shell structure: `packages/game-kit/src/shell.ts:210-255`, `docs/architecture/game-shell.md`.

## Discussion

**agent (2026-11-08):** recommend A. This is the one platform change the plan needs; it should be designed as a
generic shell feature, tested with a fake screen, and documented in `game-shell.md`.
