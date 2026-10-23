---
name: new-game
description: Create a new Tò He game from an idea — spec first, then pure logic with tests and a random-play bot, then a Phaser view built on @tohe/game-kit, finishing only when conformance passes. Use when asked to build, add or prototype a game.
---

# New game

Input: a short idea, and optionally an id. Follow `docs/guides/create-a-game.md`,
`docs/contracts/game-contract-v1.md`, ADR 0012 and ADR 0013 (themes). **`games/merge-block` is the reference
implementation** (Phaser 4 + `@tohe/game-kit`); `games/hello` is the minimal Canvas 2D example.

## 1. Spec — then stop

1. Pick an id: lowercase, dashes, 3–40 chars, not used under `games/`.
2. Write `games/<id>/SPEC.md` in the shape of `games/merge-block/SPEC.md`: board/world, a move, scoring, how it
   ends, screens, feel (juice) per event in tiers, what is saved, invariants the bot must check, and **themes**:
   light + dark following the hub (default), or one look if the game has one by nature (say why).
   For a game with pictures, a world or a lot of content, the spec also says:
   - **orientation**: `portrait`, `landscape` or `any` (the game decides; with `any`, how the screen splits sideways
     and on a desktop window — `docs/guides/create-a-game.md`, "Portrait, landscape, desktop");
   - **style**: a style of the Asset Studio (Tò He's own is the default) or a new one, and why it suits the game
     (ADR 0051);
   - **assets**: the packs it needs, from the Studio or still to make, and their licences;
   - **content**: its catalogs (items, levels, dialogue) as data with ids (`docs/guides/create-a-game.md`, "Content as
     data").
   Rules and mechanics of known games are written up already — read them before inventing: Pagat (card games, with
   regional variants), the Ludii Games Database (traditional board games, CC BY 4.0), Simon Tatham's Puzzles (puzzles
   with generators and solvers, MIT). Write the spec in your own words and name the source.
3. **Stop and ask the user to review the spec.** Do not write code before they agree.

## 2. Build

1. Copy the structure of `games/merge-block` (package.json, tsconfig with `vite/client` types, vite.config with
   `base: './'`, index.html with a DOM HUD, `public/game.json`, `public/icon.svg` with a `<title>`). Set name
   `@tohe/game-<id>`, version `0.1.0`, capabilities, `themes`, `sizeBudgetKb` (≈ 2500 for a Phaser game). In
   game.json, the names and descriptions (ADR 0048) — `name` is the **standard name**, English or a proper name such
   as *Tiến Lên*; `names.vi` only when the Vietnamese name differs; `description` is the English text:

   ```json
   "name": "Merge Blocks",
   "names": { "vi": "Ghép Khối" },
   "description": "Drop number blocks into the columns: two matching blocks merge into one. …",
   "descriptions": { "vi": "Thả khối số vào cột, …" },
   ```

   `description` is the English one; `pnpm --filter @tohe/games-host test` fails without `descriptions.vi`. Add
   `names.vi` when the game has a Vietnamese name. The game's own title in each language is the same name.
2. Add `"@tohe/game-<id>": "workspace:*"` to `devDependencies` in `tools/games-host/package.json`; `pnpm install`.
3. `src/logic.ts`: pure functions returning **the new state and events**; no DOM/timers/`Math.random`; the PRNG
   state lives in the game state (see `random`/`spawn` in merge-block).
4. `src/logic.test.ts`: rule tests + a fast-check random-play bot asserting every invariant from the spec,
   deterministic replay, and save/restore round trip.
5. `src/view.ts`: a Phaser scene that only animates events — use the kit's `juice` (`popIn`, `squash`, `pulse`,
   `burst`, `floatText`, `shake`, `confetti`), `crispText`, `sfx` and `haptics`. Layout in CSS pixels. Tiles,
   blocks and boards are `drawTexture` + `crispImage` (drawn once per value/theme/size, key says which), not
   `Graphics` or a `Text` per piece: those cost every frame on phones.
6. Three files, two stages (ADR 0020; `games/merge-block/src/` is the model):
   - `src/app.ts` — what both stages share: `connect({ gameId })`, the strings, `createSfx` (+ `settings.muted` →
     `sfx.setMuted`), the save in memory (`store`) and `persist()`. No Phaser here.
   - `src/main.ts` — the menu stage: `followTheme(session)` and the kit's `createShell` (ADR 0018–0020), which brings
     only content: `title`, `icon`, `decor`, `inProgress`, `best`, `howTo`, `tutorial: { seen, done }` (the how-to
     before the first game, kept in the save), `settings` (sections of ⚙️: `content()` controls, `when:
     'between-games' | 'any-time'`), `leaderboard` / `online`, `countdown: true` for a game against the clock, and
     `stage: () => import('./stage.ts')`; then `shell.start()`. `"shell"` in game.json's capabilities.
   - `src/stage.ts` — the play stage: `export async function start(ctx)` clones `<template id="play-stage">` into
     `ctx.root`, makes the HUD with `createHud({ menu: ctx.menuButton(), parent: ctx.root, locale })`
     (`hud.score({ score, best })` or `hud.stat(label)`, the game's own piece in `hud.center`), creates the engine
     (`createGame({ createScene })` from `@tohe/game-kit/phaser`, handle `onRestart`), continues `store`'s game or
     starts a fresh one when `ctx.fresh`, points at a first move when `ctx.firstTime`, uses `ctx.overlay` for its own
     cards and `ctx.gameOver(card)` at the end, calls `ctx.ready()` once the board is drawn, and returns
     `{ pause, resume, newGame, leave, quick }` — `pause`/`resume` → `kit.pause()/resume()` (the shell calls them
     for its panel and when the hub hides the game: do not wire `session.on('pause')` yourself), `newGame` in place,
     `leave` saves and removes every listener, timer and the engine (`kit.destroy()`), `quick()` the panel's live
     rows (the game's looks: `choices`, `switch`; `info` cards to read).
   No exit button, no HUD layout, no Esc handler and no menu of its own; save after every move; `submitScore` at the
   end; Vietnamese strings first, English second. Runs that outlast one sitting (saved mid-run): live scores instead of `submitScore` — `session.run(id).update(score)` after scoring moves,
   `finish(score)` at game over and when a new game replaces an unfinished one (id kept in the save, ADR 0014).
7. Links that open the game at a place (optional, [ADR 0045](../../../docs/decisions/0045-games-declare-identity-and-entries.md)):
   `"entries": ["share"]` in game.json, `entry: (e) => …` in `createShell` answering `handled` only for a payload it
   checked (untrusted: anyone can make one) and `invalid`/`unsupported` otherwise, the stage opening it from `ctx.entry`
   in a save slot of its own (never a ranked run), `session.share({ payload, text, level })` on the end card
   (`ctx.gameOver(card, again, [action])`), and `public/entries/share.json` with one to five payloads its share makes.
   **Its tests check** that the share makes payloads like those in `entries/share.json` and that each one opens
   (`handled`), and that hostile ones do not. Ask for more only through `session.identity.require(level, reason)` —
   save first when asking for `account`.
8. Assets and content (when the spec has them; `docs/guides/use-assets-in-a-game.md`): declare the packs in
   `public/game.json`'s `assets`, run `pnpm assets:resolve` (commit `assets.lock.json` and `src/assets.gen.ts`, both
   generated), add `toheAssets()` from `@tohe/assets/vite` to `vite.config.ts`, and load with `loadPack(scene,
   assets.<pack>)` from `@tohe/game-kit/phaser`; the credits screen appears by itself. Content lives in
   `src/content/` as `defineCatalog` lists from `@tohe/game-kit`, checked in the tests (`checkReferences`,
   `checkSchema` with Zod as a devDependency); numbers that decide the rules stay in the logic. With `orientation:
   "any"`, lay out with `onLayout`, `splitLayout` and `fitWorld` from `@tohe/game-kit/phaser`.
9. Themes (with both): `followTheme(session, theme => { scene.setTheme(theme); kit.setBackground(...) })`; art
   colours in a per-theme palette (`palette.ts`), DOM colours from the design tokens (`var(--tohe-*)`); every text
   at least 4.5:1 on its background (3:1 if large and bold).

## 3. Public page

The game's public pages, `/games/<id>/` and the English `/en/games/<id>/`, are made from its own folder
(docs/architecture/surfaces.md, "The introduction surface"); a game is not done without them, and the build fails
without them.

1. Check `public/game.json`: the descriptions are written for a stranger (`descriptions.vi` is the Vietnamese page's
   meta description, `description` the English page's), `minAge`, `orientation`, `tags` and, with `rooms`, the seats
   and bots are true — the facts table and the chips come from them.
2. Write `page/vi.md` and `page/en.md` beside `public/` (copy `games/merge-block/page/` for the shape):
   - front matter: `updated: <today, YYYY-MM-DD>` and `kind: <what it is in a few words>` (after the name in the title);
   - the answer: one or two short sentences, what it is and for whom — no numbers the facts table already holds;
   - `## Cách chơi` / `## How to play`: 3 to 5 numbered lines, in the order of a first game;
   - optionally `## Hợp với ai` / `## Who it suits` (only where it says more than the facts and the answer), `## Hỏi đáp` / `## Questions` (`### question?` and its answer) and `## Hình ảnh` / `## Pictures`
     (`![what it shows](name.png)`, the file beside the page).
   Plain text only. Proper names and established terms stay as they are. Vietnamese is the face; English the support.
3. Write `page/facts.json`: `round` — `{ "kind": "fixed", "seconds": n }`, `{ "kind": "about", "minMinutes": a,
   "maxMinutes": b }` or `{ "kind": "open" }` (no set length; the game keeps the player's place) — and `offline` —
   `false` unless playing offline after a first visit is guaranteed (no games-origin service worker yet). Write only
   what is true; ask when you do not know.
4. `pnpm --filter @tohe/web generate:og --games`: draws the game's preview pictures, `page/og.vi.png` and
   `page/og.en.png`, and their stamps, `page/og.json` (needs Chromium and Noto Sans). Look at both pictures, then
   commit them; never put them under `public/`.
5. `pnpm --filter @tohe/routes build` (the sitemap lists the new pages; commit the regenerated files) and
   `pnpm --filter @tohe/web build` (its check fails on a missing or broken page file, a missing or out-of-date picture —
   "run pnpm --filter @tohe/web generate:og" — a page without title, description, canonical, link preview, one `h1`, a
   date, or a sitemap mismatch). Look at the pages in light and dark.

## 4. Verify

```sh
pnpm --filter @tohe/game-<id> test
pnpm --filter @tohe/game-<id> typecheck
pnpm --filter @tohe/game-<id> build
pnpm --filter @tohe/game-<id> conformance
```

Open `games/<id>/test-results/conformance/<id>*.png` (one per theme) and check the screens look right on a phone. Play it in the
hub (`pnpm dev`) on a phone-sized window. Then run `pnpm verify`. Report what you built, the screenshot path, and
anything in the spec you could not honour.
