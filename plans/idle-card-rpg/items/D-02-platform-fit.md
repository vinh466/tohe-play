# D-02 — Platform fit: what Tò He allows, and the one gap

**Status:** proposed — chờ owner chốt · **Kind:** decision · **Blocked by:** D-01

## Question

Game này sống được trong giới hạn hiện tại của Tò He (64 KB save, build budget, offline, không server logic), hay cần thay đổi nền tảng trước?

## Facts

| Constraint | Fact |
|---|---|
| Save | JSON ≤ 64 KB, one save per profile, last write wins |
| Build | `sizeBudgetKb` default 3 000, max 50 000; conformance fails above the declared budget |
| Offline | Play/save/score offline; sync later; no server logic |
| Sandbox | No API calls, no `localStorage`/IndexedDB/cookies; only the Game Contract |
| Assets | Studio packs pinned in `game.json`, bundled in `studio/`; `bundle` delivery only for now |
| Shell | Two stages; quick panel has **Ván mới** and **Menu chính** |
| Scores / ranked | `scores` is a number; `ranked` replays a seeded run with a pure `verify` module |
| Themes | `light`, `dark`, or both |

## Options

### A — Adapt to the platform; one small kit enhancement (recommended)

- `sizeBudgetKb: 4500`, `orientation: portrait`, `capabilities: ["save", "shell"]`, `identity.play: "any"`.
- No Game Contract change. No API change. No new origin.
- Add **E-01**: a `persistent` option to `@tohe/game-kit`'s shell so the quick panel has no "Ván mới" and the title says "Chơi tiếp". This is a kit change with tests, not a contract change.
- Assets via Studio packs (`tohe-pixel`) where ready; direct assets only as a fallback.
- No public leaderboard in v1; local records only.

**Cost:** the game must live within 64 KB save and ~4.5 MB build; the kit change is a small PR; no ranked/board features in v1.

### B — Extend the platform first

- Asset `on-demand` delivery, a bigger default budget, a first-class "persistent game" mode, ranked daily boss.
- **Pros:** more room for content; a real leaderboard.
- **Cons:** delays the game by a platform project; the game design would be shaped by features that may not be needed; the owner wants the game, not a platform rewrite.
- **Verdict:** not now; revisit after v1 proves the loop.

### C — Split into two games

- A small battle game + a separate camp/meta game.
- **Pros:** each fits the current shell.
- **Cons:** two saves, two entries in the catalog, a broken loop; the player would have to jump between games.
- **Verdict:** reject.

## Recommendation

**A + E-01.** The platform is already sufficient for a 1-week RPG: 64 KB is 4× what a 12-hero save needs; 4.5 MB is in the same class as existing games; offline-first is a feature, not a limit. The only real mismatch is semantic: a persistent world is not a "run". Fix that in the kit, not in the contract.

## The shell gap, in one picture

```
Today (a run game):        Wanted (a persistent RPG):
title ─ Chơi ─▶ play       title ─ Chơi tiếp ─▶ world (camp/tabs)
  panel: Tiếp tục            panel: Tiếp tục
         Ván mới  ← wrong          Về làng / Menu chính
         Menu chính                (no "Ván mới")
```

E-01 adds `persistent?: boolean` (or a `panel` option) to `ShellOptions`:

- title action: **Chơi tiếp** always, with a summary line ("Làng Mây · Chương 2 · Đội 1.240");
- panel: no **Ván mới**; keeps sound, quick rows, how-to, **Menu chính**;
- `stage.newGame()` is not called by the shell; the game's own screens handle reset in settings;
- tests: a persistent shell never shows the new-game confirmation; Back still works.

## What it changes

- `game.json` fields, conformance, build size.
- The save schema and migration plan (D-03/D-06).
- The shell/E-01 work (small kit PR).
- The scores/ranked decision: deferred to v2.

## Evidence

- [R-04 — Platform fit](../research/R-04-platform-fit.md).
- `packages/contract/src/manifest.ts` (size max 50 000).
- `packages/game-kit/src/shell.ts` (panel's new-game tool).
- `docs/contracts/game-contract-v1.md`, `docs/architecture/progress-sync.md`.

## Discussion

**agent (2026-11-09):** recommend A. The platform's limits are not the bottleneck; the bottleneck is scope. A 4.5 MB pixel game and a 15 KB save are comfortable. E-01 is a small, reusable kit improvement, not a contract change. A public board would force a ranked/verify design that the game does not need in v1.

**owner:** _chưa trả lời._
