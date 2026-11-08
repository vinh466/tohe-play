# R-03 — Platform audit: what Lấp Ô can reuse

What `@tohe/game-kit`, the Game Contract and the existing games already give a block puzzle, and what a deeper
Lấp Ô would need. Paths are in this repository; line numbers are approximate.

## 1. What the kit gives

- **Two stages**: menu and play, title screen, first-time how-to, settings, quick panel, end card, Back/Escape,
  `Menu chính`, loading, credits — `packages/game-kit/src/shell.ts:1-19`, `281`, `409-473`, `673-752`,
  `docs/architecture/game-shell.md:21-49`, `106-140`.
- **HUD**: Menu, score, best, counting up, shortening large numbers, crown on a record —
  `packages/game-kit/src/hud.ts:56-143`.
- **Overlay/cards/choices/hints**: `packages/game-kit/src/overlay.ts:46-72`, `81-156`, `280-321`.
- **Synthesised SFX** (click, pop, drop, merge, combo, levelUp, error, fanfare; pitch by step) —
  `packages/game-kit/src/sfx.ts:5`, `49-166`; **haptics** 5 levels — `packages/game-kit/src/haptics.ts:2-29`.
- **Juice** (`popIn`, `squash`, `pulse`, `floatText`, `burst`, `confetti`, `shake`) —
  `packages/game-kit/src/phaser/juice.ts:10-135`.
- **Theme** by hub (`followTheme`, light/dark tokens) — `packages/game-kit/src/theme.ts:13-23`.
- **Layout** (`layoutOf`, `readSafeArea`, `onLayout`, `splitLayout`, `fitWorld`) for portrait/landscape/desktop —
  `packages/game-kit/src/phaser/layout.ts:49-170`.
- **Phaser wrapper** (DPR, resize, WebGL→Canvas fallback, pause/resume) —
  `packages/game-kit/src/phaser/game.ts:56-218`, `226-253`.
- **Content catalogs** (`defineCatalog`, `checkReferences`, `checkSchema`; Zod only in tests) —
  `packages/game-kit/src/content/index.ts:28-118`.
- **Credits** automatically when a game declares assets — `packages/game-kit/src/credits.ts:63-75`,
  `shell.ts:854-859`.
- **Telemetry** (renderer/frame times; game counts/metrics) — `docs/architecture/telemetry.md:30-39`, `88-99`.

## 2. What the contract supports

- **save**: JSON ≤ **64 KB**, enforced by the host — `packages/contract/src/protocol.ts:15`,
  `packages/game-sdk/src/host.ts:158-160`; SDK `save()` — `packages/game-sdk/src/game.ts:65-66`.
- **scores**: `submitScore`, or a live run `run(id).update/finish` — `game.ts:67-74`; score carries `board` ≤ 40,
  `run` ≤ 64, `final` — `protocol.ts:199-209`.
- **ranked**: server seed; game keeps moves; server replays with `verify` — `game.ts:155-164`;
  manifest `ranked` — `packages/contract/src/manifest.ts:184-208`; API: one open run/profile/game, max 20 runs/min,
  30 days, replay `maxMoves` — `services/api/src/Tohe.Api/Modules/Integrity/RankedRuns.cs:108-146`, `148-194`.
- **entries/share**: payload ≤ **2 KB**, `entries:["share"]`, answer within 3 s —
  `manifest.ts:50-58`, `protocol.ts:131-149`; the "Thách bạn" pattern is in
  `games/merge-block/src/challenge.ts:7-53`, `62-97`.
- **settings**: only `muted` + `theme` — `protocol.ts:36-41`; every other setting lives in the save.
- **seed**: `init.seed` from the hub; today it is the **daily seed** `YYYYMMDD`, the same for everyone —
  `apps/hub/src/launcher/manifest.ts:56-58`, `apps/hub/src/launcher/GameFrame.tsx:399`.
- **rooms**: turn-based online rooms — `game.ts:191-210`, `manifest.ts:161-178`; **not needed** for Lấp Ô.

### Where it is persisted

- Save: Dexie `saves` (local-first) → API `progress.saves` PostgreSQL; only **account profiles** sync; device
  profiles stay on the device — `docs/architecture/progress-sync.md:10-22`, `49-59`;
  `apps/hub/src/storage/db.ts:28-36`; host write `GameFrame.tsx:415-419`.
- Score: Dexie `scores` → API `progress.scores` → integrity/boards — `db.ts:38-52`, `ProgressModule.cs:130-190`;
  sync `GameFrame.tsx:423-428`.
- Ranked: Dexie `ranked` → API `integrity.ranked_runs` — `db.ts:54-65`, `GameFrame.tsx:429-435`.
- Entry payload: server object (Links), only through `init.entry`, not in save — `progress-sync.md:6-8`,
  `docs/decisions/0044-entry-links.md:49-57`.
- Offline: save/score work and sync later; `ranked.start` → unranked; share/identity unavailable —
  `progress-sync.md:70-74`, `docs/decisions/0030-ranked-runs-replayed-by-the-server.md:38-40`. The games origin has
  **no service worker**, so offline is not guaranteed — `docs/roadmap/product-backlog.md:75`.

## 3. What existing games do

- **merge-block**: save `{best, game, tutorialSeen, run, palette, ranked, challenge}` —
  `games/merge-block/src/app.ts:10-30`; live run update/finish — `stage.ts:73-74`, `184-202`; ranked + challenge
  + palette + replay — `app.ts:74-93`, `118-126`; verify module — `src/verify.ts:12-29`.
- **tap-merge**: "rising floor" by the largest block, milestone clears the smallest value, scores it —
  `games/tap-merge/src/logic.ts:88-102`, `270-325`; shuffle rescue when stuck — `logic.ts:331-374`; HUD target,
  banner, long-game simulation — `SPEC.md:60-82`, `92-105`, `107-141`.
- **vuon-rau**: content-as-data (`crops`, `lines`, `map`) — `src/content/crops.ts:6-50`,
  `content/lines.ts:19-96`; a farm that lives forever with real-time ticks — `src/logic.ts:24-32`, `63-72`,
  `91-109`; save after every action — `src/stage.ts:53-61`; asset pack + credits — `src/app.ts:8-34`,
  `src/main.ts:33-63`.

## 4. Gaps for a deeper Lấp Ô

| Need | Where it can live | Verdict |
|---|---|---|
| Level/mission data | `defineCatalog` in the game; numbers in code | **in the game** — no server load |
| Journey/stats/achievements screens | shell has no free screen hook | **kit change** (E-01) |
| Daily seed | `session.seed` is already `YYYYMMDD` | **partly there**; full daily board/leaderboard needs platform (PB-06) |
| Cross-device progress | save sync; account profiles only; last-write-wins | **already there**, with caveats |
| Per-level leaderboard | API accepts `board` ≤ 40, but the hub reads `default` | **needs platform UI**; skip in MVP |
| Achievements in the hub | hub shows only best for 3 recent games | **needs platform**; show in-game first |
| Ranked endless | contract + API exist | **possible**, but simulate first; `maxMoves` risk |
| Board skins/palettes | game save + textures | **in the game** |
| Public pages | standard `/new-game` step | **already there** |

## 5. Constraints

- **Size**: `sizeBudgetKb` default 3000, max 50000 — `manifest.ts:246`; merge/tap use 2500. Dist is ~1.6 MB,
  mostly Phaser; content data is tiny.
- **No network outside the game folder, no own storage, no eval/pop-up/form** —
  `docs/contracts/game-contract-v1.md:263-290`; CSP `packages/contract/src/csp.ts:8-20`.
- **CSP**: `'self'`, `data:`, `blob:`; WebAssembly allowed; no inline script — `csp.ts:10-18`.
- **Orientation**: declared in `game.json`; the hub does not lock; a portrait game on a landscape phone gets a
  "turn upright" layer — `manifest.ts:236`, `docs/architecture/surfaces.md:136-140`.
- **Light/dark**: both, follow `settings.theme`, WCAG AA; canvas is not checked by axe, so the game must test its
  palette — `manifest.ts:238-243`, `game-contract-v1.md:274-277`.
- **vi/en**: `init.locale`, strings in game; public pages `vi.md`/`en.md` — `surfaces.md:258-313`.
- **minAge 3 / family mode**: `minAge` filters the catalog for a child profile — `manifest.ts:244`,
  `services/api/src/Tohe.Api/Modules/Registry/RegistryModule.cs:87-89`; family is a layer, not a runtime mode —
  `docs/decisions/0057-a-game-shelf-for-16-plus.md:46-50`, `82-87`.
- **No ads/IAP/tracking**: `docs/vision.md:49-56`; telemetry is technical only —
  `docs/architecture/telemetry.md:18-28`, `82-86`.

## 6. Risks and opportunities

### Risks

- **Seed reuse**: `session.seed` is the daily seed; if "Chơi lại" reuses it, every restart is the same board.
  Merge-block avoids this with `previous?.rng ?? session.seed` — `games/merge-block/src/stage.ts:48-55`.
- **64 KB with ranked**: keeping every move can hit the limit on a long run; use compact move codes and keep
  moves only for the current ranked run.
- **Ranked/conformance**: `verify` must run with `Math.random`/`Date.now` throwing, and the bot must finish or
  reach `maxMoves` — `game-contract-v1.md:419-424`. The helpful draw can make runs long; simulate before
  declaring `ranked`.
- **Daily fairness**: the date is local and the clock can be changed; a daily score on the `default` board would
  mix with endless. A separate board needs platform.
- **Hub progress**: "Tôi" shows only local best; a journey/achievement surface needs platform or stays in-game.
- **UI**: a 5-cell piece plus two others may not fit the tray at 320 px; the layout needs a real prototype.

### Opportunities

- Reuse the merge-block skeleton for the 8 × 8 core, save/run/ranked/verify/challenge.
- Use tap-merge's milestone/rising-floor idea as a **within-run** progression if the endless mode needs more.
- Use `defineCatalog` for levels, goals, skins, achievements.
- Use the kit's juice, palette, theme and layout; draw blocks as textures, so no asset pack is needed for MVP.
- A generic shell `screens` API benefits the journey, stats, achievements and future games.

## 7. Implications for Lấp Ô

1. Build the core first from the merge-block skeleton; do not add platform work until the core is fun.
2. Put journey/stats/achievements in the save and behind a new shell `screens` API (E-01).
3. Keep `ranked` out of MVP; add it in V4 only after simulation shows runs end within `maxMoves`.
4. Use the raw daily seed for the daily challenge and mix it for endless restart (E-03).
5. Draw textures; avoid an asset pack for MVP; keep the size near Ghép Khối.
6. Plan a real 320/360/390 px tray prototype before the spec is final.
