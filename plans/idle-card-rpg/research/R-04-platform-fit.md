# R-04 — Platform fit: what Tò He allows, and the one gap

Date: 2026-11-09 · Status: first pass

Question: một RPG thẻ bài treo máy cỡ 1 tuần nội dung có sống được trong Game Contract hiện tại không, và cần thay đổi gì?

## Facts from the repository

| Constraint | Fact | Source |
|---|---|---|
| Save | JSON, **64 KB** per game, one save per profile; last write wins | `docs/contracts/game-contract-v1.md`, `docs/architecture/progress-sync.md` |
| Build size | `sizeBudgetKb` default **3000**, max **50 000**; conformance fails above the declared budget | `packages/contract/src/manifest.ts` |
| Offline | Play, save and score offline; sync later; no server logic | `docs/architecture/progress-sync.md` |
| Sandbox | Game is an iframe on its own origin; no API calls, no `localStorage`/IndexedDB/cookies; only the Game Contract | `docs/contracts/game-contract-v1.md` |
| Assets | Asset packs pinned in `game.json`, bundled in `studio/` (delivery `bundle` only for now) | `docs/contracts/game-contract-v1.md`, ADR 0051/0053 |
| Shell | Two stages: menu stage (title/settings/how-to) and play stage (created on play, destroyed on menu); quick panel has **Ván mới** and **Menu chính** | `docs/architecture/game-shell.md`, `packages/game-kit/src/shell.ts` |
| Scores / ranked | `scores` is a number; `ranked` replays a seeded run with a pure `verify` module | `docs/contracts/game-contract-v1.md` |
| Themes | `light`, `dark`, or both; both follow the hub | `docs/contracts/game-contract-v1.md` |
| Orientation | `portrait` / `landscape` / `any`; no lock, a portrait game on a sideways phone shows a turn overlay | `docs/contracts/game-contract-v1.md` |
| Tooling | `@tohe/game-kit`: shell, overlay, HUD, Phaser setup, juice, layout, content catalogs; `tohe-studio` for pixel packs | `packages/game-kit`, `packages/studio` |

## Size estimate

| Piece | Estimate |
|---|---|
| Phaser 4 + game-kit + app code | 1.2–1.6 MB (merge-block's whole dist is 1.6 MB) |
| Pixel art (12 heroes, 12 enemies, 3 bosses, UI, backgrounds, FX) | 0.8–1.4 MB |
| Audio (2–3 loops + ~30 SFX, compressed) | 0.3–0.6 MB |
| Content data (stages, heroes, text) | < 0.1 MB |
| **Total** | **2.5–3.7 MB** |

A declared budget of **4 500 KB** leaves headroom for a fourth chapter or extra bosses, and is still in the same class as the existing 2.5 MB games. No platform change is needed for size.

## Save estimate

A compact v1 save:

```json
{
  "v": 1,
  "camp": 12,
  "gold": 18400,
  "essence": 320,
  "shards": 740,
  "stage": "2-7",
  "heroes": { "h1": { "star": 3, "gear": { "w": "g12", "a": "g9", "c": null, "r": "g3" } } },
  "gear": { "g12": { "id": "g12", "tier": 2, "plus": 3, "set": "ember" } },
  "buildings": { "farm": 3, "mine": 2, "spring": 1 },
  "seen": 1731100000000,
  "flags": { "tutorial": 1, "daily": 1731090000000 }
}
```

12 heroes × ~200 B + 48 gear pieces × ~120 B + progress/currency ≈ **10–15 KB**. Even a 40-hero/200-gear v2 stays under 64 KB. The save must be versioned and migrated; no battle logs, no full content data.

## The one real gap: a persistent game does not fit the shell's "Ván mới"

The kit's shell assumes a **session**: title → play → a run that can be restarted with **Ván mới**. An RPG is a **persistent world**: camp, roster, gear, stages, dailies. Its quick panel should have **Tạm dừng / Tiếp tục / Menu chính**, not "Ván mới" (which would reset or confuse).

Three ways out:

| Option | What it means | Cost | Verdict |
|---|---|---|---|
| **A. Use the shell with overridden strings** | Rename "Ván mới" to "Về làng"; `newGame()` returns to camp, never resets the save | Low: no kit change; semantics are a hack; the confirmation copy is wrong | Workable for a prototype, not for the real game |
| **B. Add `persistent: true` to the kit's shell** | Hides "Ván mới"; panel shows resume/quick rows/main menu; title says "Chơi tiếp"; the game's own screens live in the play stage | Small kit change + tests; no contract change | **Recommended** (E-01) |
| **C. Do not declare `shell`; use the hub's bar** | The hub draws its top bar; the game owns the rest; no title screen of its own | Low; loses immersion and the game's own title/menu; the hub bar takes vertical space | Fallback only |

**Recommendation: B.** It is a game-kit enhancement (E-01), not a Game Contract change. It also helps any future persistent game (a farm, a city builder, a collection).

## Scores, ranked and the daily boss

- An RPG's progress (camp level, stage, power) is **not a run**; submitting it as a `score` would put an unverified number on a board.
- **v1: no public leaderboard.** Use local records (best stage, tower floor, boss damage) on the camp/codex screens.
- **v2 candidate:** a **daily boss run** with a fixed seed, a fixed team-size rule, and a pure `verify` module. That is a real ranked run: the server can replay it. It would need `scores` + `ranked` in `game.json` and a small rule set (no gear RNG in the run; gear stats snapshotted into the seed? This is a design problem for later).
- Do not promise a leaderboard in v1; it would shape the battle and save design for a feature we cannot validate yet.

## Offline and the clock

- The game computes offline income from `Date.now()` and the saved `seen` timestamp. A player can change the device clock; without monetization or competition, that is acceptable. Cap at 12 h and clamp negative deltas.
- The hub's save is written on `save()` and synced later; the game should save on: stage clear, level/star/gear change, summon, building upgrade, app pause, and every ~30 s during a session.
- A save conflict is last-write-wins; the game should keep the save small and idempotent, and never store a battle in progress that cannot be resumed.

## Assets and the Studio

- The Studio's pixel style (`tohe-pixel`) enforces palette, tile size and binary alpha; packs are versioned and pinned.
- For v1, use packs for **heroes, enemies, UI, FX, backgrounds, audio**. If a needed kind is not ready, direct assets in the build are allowed, but the plan should prefer packs to prove the pipeline.
- The build is immutable; new content = a new game version. The content pipeline (D-11) must make a chapter/hero addition a data + art change, not a code change.

## Conclusion

- **No Game Contract change is needed for v1.** Declare `sizeBudgetKb: 4500`, `orientation: portrait`, `capabilities: ["save", "shell"]`, `identity.play: "any"`.
- **One kit enhancement is recommended: E-01, a persistent-game shell.**
- **Defer**: asset on-demand, ranked daily boss, public leaderboards, cross-device battle state, live events.
