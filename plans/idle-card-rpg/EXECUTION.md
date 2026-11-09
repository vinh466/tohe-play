# Execution — Vân Du Ký (implementation)

This is the working ledger for the build. The plan (`PLAN.md`) decides **what**; this page says **where we are** and
what to do next. Update it at the end of every session, newest session first in the log.

- Branch: `feat/van-du-ky-core` (based on `plan/idle-card-rpg`)
- Worktree: `/home/vinh/.local/share/opencode/worktree/2794c1/van-du-ky-core`
- Current checkpoint: **C3 — playable board (first pass)**; C4 (region 1) is in
- Release: not started; no deploy, no tag, no merge without the owner's word.

## Checkpoints

| # | Checkpoint | Done when | Status |
|---|---|---|---|
| C0 | Spec & ADRs | `games/van-du-ky/SPEC.md`; ADR 0059 (save budget); docs updated; docs build | **done** (ADR 0060 deferred with P0b) |
| C1 | Platform P0a | save budget in contract/API/hub; E-01 persistent shell; E-03 FX player; tests | **done** (on-demand is P0b) |
| C2 | Game core | pure battle/progression/economy + catalogs + save + tests + sim | **done** |
| C3 | Playable board | Phaser board + DOM sheets + one FX effect; 360×640; 60 fps | **first pass** (no FX yet) |
| C4 | Content slice | region 1 (12 stages), 6 heroes, 1 boss | **done** (event later) |
| C5 | Full v1 content | 4 regions, 20 heroes, 20 enemies, 4 bosses, 2 events, tower, daily, world boss | todo |
| C6 | Release candidate | build, conformance, `pnpm verify`, public pages, OG, sitemap, report | todo |

## Staging and deviations

1. **Asset on-demand is P0b, after C3.** The first playable uses bundled placeholder art under the build budget; the
   contract keeps `delivery: "bundle"` until on-demand is implemented. Do not add `on-demand` to the contract before the
   hub/Studio/API can serve it. Record the deferral in `PLAN.md`/log. The full 20-hero art needs P0b or a larger build.
2. **Full content is C5, not C1–C3.** Build the engine and a 6-hero/12-stage slice first; add the rest through data.
3. **The game is dark-only** (`themes: ["dark"]`), as decided in D-13. The hub is still light/dark; the game keeps its
   own look. Screenshot the game at 360 px.
4. **No music** (D-15). SFX + haptics only.
5. **The board is 6v6 / 3 rows**; the 360×640 test is a gate, not a nice-to-have.

## Workstreams

### G0 — Spec & docs

- [x] `games/van-du-ky/SPEC.md`: board, 6v6/3 rows, elements/roles, progression, content, save, UX, art, SFX, themes.
- [x] ADR 0059: a game's save budget (`saveBudgetKb`, default 64 KB, max 1 MB).
- [ ] ADR 0060: asset on-demand delivery (design only; implement in P0b).
- [x] `docs/contracts/game-contract-v1.md`: `saveBudgetKb` row and save section.
- [x] `docs/architecture/progress-sync.md`: per-game save budget.
- [x] `docs/architecture/game-shell.md`: `persistent` shell.
- [x] `docs/architecture/game-fx.md` (new): pixelfx sprite sheets, act timing, E-03, licensing.
- [x] `docs/decisions/index.md`: row for 0059 (0060 deferred).
- [x] `pnpm --filter @tohe/docs build` passes.

### P0a — Platform

- [x] Contract: `saveBudgetKb` in `GameManifest`; regenerate JSON schema; update contract tests.
- [x] SDK host: enforce `manifest.saveBudgetKb * 1024`; update docs/tests.
- [x] API: `Game.SaveBudgetKb`, catalog sync, migration, `PUT /api/progress/saves/{gameId}` uses it; tests.
- [x] Hub: `createHost` reads the manifest budget; manifestFrom carries it.
- [x] E-01 `persistent` in `ShellOptions`: no `Ván mới`; title `Chơi tiếp`; no `stage.newGame()`; tests.
- [x] E-03 `playFx` in `game-kit/phaser`: sprite sheet + act timing + hit callback + reduced motion; pure timing tests.
- [x] Kit exports; `pnpm --filter @tohe/game-kit typecheck test` (version bump pending).

### P0b — Asset on-demand (after C3)

- [ ] ADR/contract `delivery: on-demand`; Studio/hub/API/conformance; offline cache.
- [ ] Until then, keep `bundle`; the build stays under the declared `sizeBudgetKb`.

### G1 — Game core

- [x] Scaffold `games/van-du-ky`: package, tsconfig, vite (`base: './'`), `public/game.json`, icon, `page/`.
- [x] Pure core: `rng`, `stats`, `battle`, `progression`, `economy`, `save`, `content`.
- [x] Catalogs: heroes, skills, enemies, regions, stages, loot; events/fx later.
- [x] Tests: turn order, damage, elements, rows, auto-cast toggle, win/lose, star/gear, save/restore.
- [x] Balance sim: plays the 12-stage slice; 48 stages later.
- [x] Save envelope: versioned; normalize; budget-aware; save on stage clear/upgrade/summon.

### G2 — UI/UX

- [x] Research: R-09 at 360×640; sheet heights; one-hand reach; offline card; summon pity.
- [ ] Wireframe v4: board/formation/hero/summon done in the UI; codex/daily later.
- [x] Phaser board: 6v6/3 rows, clash, damage numbers, auto-cast, speed, stop, upgrade; turn rail later.
- [x] DOM sheets: team, hero, gear (in hero), summon, offline; codex/daily later.
- [ ] SFX/haptics; reduced motion; empty/loading states.
- [x] Screenshots at 390×844 and conformance 360×640; hub playtest later.

### G3 — Release

- [x] `pnpm --filter @tohe/game-van-du-ky test/typecheck/build/conformance`.
- [x] public pages, OG images, sitemap; `pnpm verify` pending.
- [ ] Report the release candidate to the owner. No deploy/tag/merge without their word.

## Gates (every code change)

```sh
pnpm exec biome check <paths>                         # V0
pnpm exec turbo run typecheck test --filter=<pkg>     # V1
pnpm verify                                           # V2, before a PR
```

V3 by kind: contract → conformance + schemas + ADR/docs; API → tests on PostgreSQL + regenerate OpenAPI/types; game →
conformance + SPEC + public pages; kit → typecheck/tests; docs → docs build.

## Resume here

1. `git status -sb`; read the newest log entry below.
2. Read `PLAN.md` → decisions, then this file's current checkpoint.
3. Continue at the first unchecked item; run the gate for the package touched.
4. At session end: tick items, set `Current checkpoint`, add a log entry (≤5 lines), commit.

## Session log

Newest first. One entry per session: what moved, what is blocked, next.

### 2026-11-09 — agent (first playable)

- G0 spec + ADR 0059; G1 save budget across contract/SDK/API/hub; E-01 persistent shell; E-03 FX player.
- Game scaffold, pure core (battle/stats/progression/economy/save), 6-hero/12-stage slice, tests and balance report.
- Phaser board + DOM team/hero/summon/offline sheets; conformance passes at 360×640; public pages + OG.
- Next: turn rail/top strip, codex/daily/gear-equip sheets, SFX/haptics, full content, `pnpm verify`, then release candidate.
- No owner action needed yet.
