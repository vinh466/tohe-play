# Execution — Vân Du Ký (implementation)

This is the working ledger for the build. The plan (`PLAN.md`) decides **what**; this page says **where we are** and
what to do next. Update it at the end of every session, newest session first in the log.

- Branch: `plan/hex-board` for the hex-board research (game work merges via `feat/van-du-ky-core`)
- Worktree: `/home/vinh/.local/share/opencode/worktree/2794c1/van-du-ky-core`
- Current checkpoint: **C10 — combat feedback live** (v1.1.1, prod-2026-11-10.5, 2026-11-10); C9 12-cell hex board live
  in v1.1.0; C8 concept approved; C7 UI/UX v2 and C6 v1.0.0 released before it
- Release: v1.1.1 live (prod-2026-11-10.5), UAT `uat-2026-11-10.5`, chart `0.1.0-g1214065`; v1.1.0 superseded.

## Checkpoints

| # | Checkpoint | Done when | Status |
|---|---|---|---|
| C0 | Spec & ADRs | `games/van-du-ky/SPEC.md`; ADR 0059 (save budget); docs updated; docs build | **done** (ADR 0060 deferred with P0b) |
| C1 | Platform P0a | save budget in contract/API/hub; E-01 persistent shell; E-03 FX player; tests | **done** (on-demand is P0b) |
| C2 | Game core | pure battle/progression/economy + catalogs + save + tests + sim | **done** |
| C3 | Playable board | Phaser board + DOM sheets + kit FX; 360×640; 60 fps | **done** (shake/float/tween, SFX, haptics) |
| C4 | Content slice | region 1 (12 stages), 6 heroes, 1 boss | **done** |
| C5 | Full v1 content | 4 regions, 20 heroes, 20 enemies, 4 bosses, 2 events, tower, daily, world boss | **done** |
| C6 | Release candidate | build, conformance, `pnpm verify`, public pages, OG, sitemap, report | **done** (v1.0.0 live, prod-2026-11-10.1) |
| C7 | UI/UX v2 | layout, HUD, turn rail, cards, performance, sheets, tests, screenshots | **done** (v1.0.1 live) |
| C8 | Hex board concept | R-12 + wireframe v6; R-13 tech spike; R-14 effects/expansion; 12 cells/side, loss popup/retry, auto always, DOM recommended | **done** (owner approved 2026-11-10) |
| C9 | 12-cell hex board | core columns 0–3, 12-cell formations/terrain, DOM/CSS board, loss popup/rewind, auto road, effect pass, tests, conformance | **done and live** (v1.1.0, prod-2026-11-10.3, 331 KB, p50 16.7 ms) |
| C10 | Combat feedback | ×1 default and ×2/×5/×10; readable streak/slash/impact/ring; side labels, low-HP and ready pips; UI review | **done and live** (v1.1.1, prod-2026-11-10.5) |

## Staging and deviations

1. **Asset on-demand is P0b/P1.** v1 bundles its 44 portraits (~40 KB) and stays at 1.6 MB of the 8 MB budget, so
   on-demand delivery is not needed to ship. The contract keeps `delivery: "bundle"` until the hub/Studio/API can serve
   `on-demand`; that work is P1, not a v1 gate.
2. **Full content is C5, not C1–C3.** Build the engine and a 6-hero/12-stage slice first; add the rest through data.
3. **The game is dark-only** (`themes: ["dark"]`), as decided in D-13. The hub is still light/dark; the game keeps its
   own look. Screenshot the game at 360 px.
4. **No music** (D-15). SFX + haptics only.
5. **The board is 6v6 on 12 cells per side** (6 deployed, 6 open) with four lanes and three ranks; the 320×568 test is a gate, not a nice-to-have.

## Workstreams

### G0 — Spec & docs

- [x] `games/van-du-ky/SPEC.md`: board, 6v6/3 rows, elements/roles, progression, content, save, UX, art, SFX, themes.
- [x] ADR 0059: a game's save budget (`saveBudgetKb`, default 64 KB, max 1 MB).
- [ ] ADR 0060: asset on-demand delivery (P1; v1 bundles 1.6 MB of an 8 MB budget).
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

- [ ] ADR/contract `delivery: on-demand`; Studio/hub/API/conformance; offline cache (P1).
- [x] Until then, keep `bundle`; the build stays at 1.6 MB, under the 8 MB `sizeBudgetKb`.

### G1 — Game core

- [x] Scaffold `games/van-du-ky`: package, tsconfig, vite (`base: './'`), `public/game.json`, icon, `page/`.
- [x] Pure core: `rng`, `stats`, `battle`, `progression`, `economy`, `save`, `content`.
- [x] Catalogs: heroes, skills, enemies, bonds, regions, stages, gear, events (expedition/tower/boss/challenge).
- [x] Tests: turn order, damage, elements, rows, auto-cast toggle, win/lose, star/gear, save/restore.
- [x] Balance sim: plays all 48 stages; all win with the growth curve.
- [x] Save envelope v2: versioned plus a v1 migration; normalize; budget-aware; daily/weekly blocks.

### G2 — UI/UX

- [x] Research: R-09 at 360×640; sheet heights; one-hand reach; offline card; summon pity.
- [x] Wireframe v4: board, formation, hero, gear, summon, stage picker, codex, daily, offline, events.
- [x] Phaser board: 6v6/3 rows, portraits, turn rail, clash, damage numbers, auto-cast, speed, stop, upgrade.
- [x] DOM sheets: team, hero, gear, summon, offline, stage picker, codex, daily, events, credits.
- [x] SFX/haptics; reduced motion; empty states; sheets pause the board.
- [x] Screenshots at 390×844 and conformance 360×640; stage-clear and expedition played in Chrome.

### G3 — Release

- [x] `pnpm --filter @tohe/game-van-du-ky test/typecheck/build/conformance`.
- [x] public pages, OG images, sitemap; `pnpm verify` green (API 610/610, all games conformance).
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

### 2026-11-10 — agent (v1.1.1 released)

- PR [#213](https://github.com/vinh466/tohe-play/pull/213) merged (`1214065`); main CI green; images and chart published.
- UAT `uat-2026-11-10.5` deployed and checked 20/20; prod `prod-2026-11-10.5` tagged with notes; platform-infra PR
  [#366](https://github.com/vinetic-spaces/platform-infra/pull/366) merged; Argo synced.
- `check:prod` 23/23; production `apiVersion` is `sha-12140658f7c2…`; catalog has `van-du-ky 1.1.1`.
- Next: owner playtest of ×1/×2/×5/×10; `Chiêu` tab and lane bonuses remain later steps.

### 2026-11-10 — agent (v1.1.1 combat feedback RC)

- Owner feedback: attack/hit effects were not visible; make ×1 the default and slower, with ×2/×5/×10; review UI/UX.
- Speed: default ×1, options ×2/×5/×10; a v2 save without the new `speedV2` flag is reset once to ×1; modern saves keep
  the chosen speed. ×1 is ~0.8 s per turn.
- Attack feel: element streak from attacker to target, attacker cast glow, larger lunge, coloured slash + impact wash,
  element ring, flash, stronger sparks, bigger damage numbers, hit-stop, lingering hit glow.
- UI review: `ĐOÀN`/`ĐỊCH` labels above the grid, low-HP red bars, ready pips glow, speed button state and hint.
- Verified: typecheck, 74 tests, balance sim 48/48, build, conformance PASS; p50/p95 16.7 ms at ×1 and ×10 at 360,
  no long tasks. Next: owner playtest; release word before PR/merge/tag.

### 2026-11-10 — agent (v1.1.0 released)

- PR [#211](https://github.com/vinh466/tohe-play/pull/211) merged; main CI green including API, all conformance, chart and
  E2E; images and chart published for `2bc38b6`.
- UAT `uat-2026-11-10.3` deployed and checked 20/20; prod `prod-2026-11-10.3` tagged with notes; platform-infra PR
  [#364](https://github.com/vinetic-spaces/platform-infra/pull/364) merged; Argo synced.
- `check:prod` 23/23; production `/api/config` reports `sha-2bc38b695b55…`; catalog has `van-du-ky 1.1.0`.
- Next: owner playtest and feedback; `Chiêu` tab and lane bonuses are the next planned UI steps.

### 2026-11-10 — agent (12-cell hex board implemented)

- Owner approved the DOM/CSS + effect direction ("hợp lý, chốt mạnh như v làm chuẩn đi").
- Core: `Column` 0–3, 12-cell starter/formation, `DEPLOY_SLOTS` two per rank, terrain stat marks; replay pays gold only.
- View: Phaser removed; DOM/CSS 24-hex board (`view.ts`), pooled numbers, CSS/WAAPI hit/crit/active/heal/shield/death,
  ×3 and reduced-motion variants, cached centres. Stage deck: road + 3-line feed, 12-cell bench, loss popup, wall.
- Win: no modal, clear ribbon + road marker + next stage after ~0.8 s. Loss: small popup, auto rewind to wave start,
  basic gold only, one retry then wall. Boss: one gold-rimmed hex. Auto always; only `Dừng`.
- Verified: typecheck, 73 tests, balance sim (48/48), build (331 KB), conformance PASS; headless DPR 2 p50/p95 16.7 ms
  at 320/360/390, no long tasks. Full `pnpm verify`: 62/63 tasks; the pre-existing API hard-bot timing test failed at
  21.6 s (>20 s) under suite load, passes alone (609/610). Next: owner's release word; then PR, merge, tag, UAT/prod.

### 2026-11-10 — agent (DOM/CSS and effects spike)

- Owner asked whether DOM/CSS expands well and how to make attacks/hits feel better.
- Wrote `research/R-14-effects-and-expansion.md`: growth table, effect tiers (hit/crit/active), heal/shield/status/death,
  timing, perf rules (compositor-only, pools, cached centres), ×3 and reduced-motion variants, canvas overlay as escape hatch.
- Built `research/tech-spike/dom-effects.html`: 24 hexes, 6v6, turn rail, road/feed, interactive effect buttons;
  p50/p95 16.7 ms at DPR 2, no long tasks; verified orb → impact → flash/ring/number/hp-ghost sequence (`?manual`, `window.vdDemo`).
- Next: owner approves the DOM board + effect direction; then implement core columns 0–3, 12-cell stages, the DOM view,
  loss popup/auto rewind and the effect pass.

### 2026-11-10 — agent (pentagon board concept)

- Owner review of 1.0.1: UI bugs fixed, performance average (keep improving), content okay; wants a new battle-screen
  concept: pentagon cells, left/right, more cells than 6, minimal cards, no blocking win popup, use the tall bottom.
- Wrote `research/R-12-hex-board.md` and `wireframes/hex-board-v6.html`: 6×4 flat-top hexagons, 12 cells/side,
  6 deployed, 6 open; seamless honeycomb; road + feed + tabs at the bottom; loss popup + auto retry.
- Owner feedback: 12 cells, loss popup + auto rewind (gold only), auto always, boss 1 cell, terrain if cheap. Open: retry-win rewards, card text, deck tabs, DOM/CSS vs Phaser.
- Wrote `research/R-13-tech-stack.md` and `research/tech-spike/dom-board.html`: DOM/CSS 24 hexes, 12 units, 170 numbers/6 s, p50 16.7 ms at 320/360/390, no long tasks.
- Next: owner approves DOM/CSS; then core columns 0–3, 12-cell formation/stages and the DOM view.

### 2026-11-10 — agent (UI/UX v2)

- Owner playtest: overlapping UI and lag. R-10 measured 20 fps p50 / 50 ms frames and 150–190 ms long tasks in headless
  Chrome at 360×640, and a top strip over the first card row at 320×568.
- Stage is now a flex column (HUD / board / controls / dock); 44 portraits in one atlas; cards are pre-drawn textures;
  turn rail is portrait chips; damage numbers are pooled DOM; `maxDpr` 1.25; no per-tick card text.
- Sheets: sticky header, grab handle, slide-in, wrapped codex tabs, honest disabled states; HUD shows gold/essence,
  company level, wave and a Today badge; dock is Đội/Trang bị/Triệu hồi/Sổ tay/Hôm nay.
- Headless result: p50 49.9→16.7 ms at 320, 50→33.3 ms at 360/390; long tasks 19/100+/85 → 2/0/0. Layout test at
  320×380, 360×452, 390×652; screenshots at 320/360/390.
- Next: PR [#210](https://github.com/vinh466/tohe-play/pull/210) CI green; owner's release word.

### 2026-11-09 — agent (v1.0.0 release candidate)

- Full v1: 4 regions × 12 stages, 20 heroes, 20 enemies + 4 bosses, 10 bonds, 44 pixel portraits, save v2.
- Story board + tower 40 + daily expedition + weekly boss + weekly challenge + Khởi Hành; stage picker, codex, gear, daily sheets.
- Balance sim clears all 48 stages; SFX/haptics/reduced motion; public pages and OG for v1.
- `pnpm verify` green: contract/SDK/kit/API 610 tests, all game builds and conformance. PR #208 CI green (verify, API, all conformance, e2e, chart).
- Next: owner's release word ("merge", "deploy", "lên prod"); then merge, tag and deploy per docs/guides/environments.md.

### 2026-11-09 — agent (first playable + P0a)

- G0 spec + ADR 0059; G1 save budget across contract/SDK/API/hub; E-01 persistent shell; E-03 FX player.
- Game scaffold, pure core (battle/stats/progression/economy/save), 6-hero/12-stage slice, tests and balance report.
- Phaser board + turn rail + SFX + DOM team/hero/summon/offline sheets; conformance passes at 360×640; public pages + OG.
- `pnpm verify`: all tasks pass except the API test suite in parallel (local inotify instance limit; API passes sequentially with `-parallelMode none`, 610/610). Conformance all games passes.
- Next: codex/daily/stage-picker/gear-equip sheets, full 20/20/4/2 content, asset on-demand P0b, then release candidate.
- No owner action needed yet.
