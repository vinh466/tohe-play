# E-01 — A persistent game's shell (no "Ván mới")

**Status:** proposed — chờ owner chốt · **Kind:** enhancement · **Blocked by:** D-02, D-12

## The gap

`@tohe/game-kit`'s shell assumes a **run**: title → play → a game that can be restarted with **Ván mới** (`packages/game-kit/src/shell.ts`). An RPG is a **persistent world**: camp, roster, gear, stages, dailies. Its quick panel should be:

```
Tạm dừng
  Tiếp tục
  Âm thanh
  [game rows: đội hình, nhiệm vụ, …]
  Cách chơi
  Menu chính
```

There is no "Ván mới"; a reset is a destructive settings action, not a panel button. Today the panel always shows **Ván mới** (`shell.ts`, the `tools` array), and the title shows **Ván mới** when a run is in progress. The copy says "Ván đang chơi sẽ kết thúc" — wrong for a world.

## Options

### A — Override the strings (no kit change)

Rename `newGameShort`/`newGame` to "Về làng" and make `stage.newGame()` return to camp, never reset the save. The confirmation still says "Ván đang chơi sẽ kết thúc", and the semantics are a lie. Workable for a prototype; not for the real game.

### B — Add a `persistent` option to `ShellOptions` (recommended)

```ts
createShell({
  // …
  persistent: true,
});
```

Behaviour:

- Title action is always **Chơi tiếp** (or **Chơi** on a fresh save); no **Ván mới** button.
- The panel has no **Ván mới** tool; it keeps sound, the game's quick rows, how-to and **Menu chính**.
- The shell never calls `stage.newGame()`; a reset lives in the game's settings, behind a confirmation.
- The title's summary line is the game's `inProgress()` (e.g. "Làng Mây · Chương 2 · Đội 1.240").
- `data-tohe-play` / `data-tohe-main-menu` / `data-tohe-exit` stay exactly as conformance expects.
- A persistent game can still use `screens` for full-screen tools (codex, records, settings).

**Cost:** one small kit change + tests; no contract change; other games are untouched (default `persistent: false`).

### C — Do not use `shell`; use the hub's bar

The hub draws its top bar; the game owns the rest. No title screen of its own, less immersion, less vertical space. Fallback only.

## Recommendation

**B.** It is the smallest change that makes the kit honest for a whole class of games (RPG, farm, city builder, collection). It also lets the game keep the kit's title screen, quick panel, safe-area handling and conformance markers.

## Tests the change needs

- A persistent shell never shows the new-game tool or confirmation.
- The title shows **Chơi tiếp** with a save, **Chơi** without one.
- `stage.newGame()` is never called by the shell.
- Back: play → panel → play; panel → title; title → Tò He.
- A non-persistent game behaves exactly as today (snapshot/behaviour test).

## Evidence

- `packages/game-kit/src/shell.ts` (panel `tools`, title actions).
- `docs/architecture/game-shell.md` (the two stages, the panel).
- [R-04 — Platform fit](../research/R-04-platform-fit.md).
- [D-02 — Platform fit](../items/D-02-platform-fit.md).

## Discussion

**agent (2026-11-09):** the gap is real but small. Overriding strings (A) would ship a confusing "Ván mới" that resets a world; C gives up the game's own title and costs vertical space. B is a one-option kit change with clear tests.

**owner:** _chưa trả lời._
