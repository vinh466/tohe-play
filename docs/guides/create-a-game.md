---
title: Create a game
description: From a one-paragraph idea to a game that passes conformance and plays on a phone.
sidebar:
  order: 2
---

`games/hello` is the reference implementation. Copy its structure; it is small on purpose.

## Steps

1. **Write the spec first.** Create `games/<id>/SPEC.md`: the rules in plain words, the screens, what is saved,
   what is scored, how a round ends, and its **themes** — light and dark like the hub (the usual choice), or one
   look if the game has one by nature ([Theming](../architecture/theming.md)). Get it reviewed before writing code —
   it is the source of truth for the game.
2. **Scaffold** from `games/hello`:
   - `package.json` — name `@tohe/game-<id>`, same scripts;
   - `public/game.json` — new `id` (= folder name), `name`, `version: 0.1.0`, capabilities, `themes`, size budget;
   - `public/icon.svg` — square, with a `<title>`;
   - `vite.config.ts` — keep `base: './'`.
3. **Register** the game: add `"@tohe/game-<id>": "workspace:*"` to `devDependencies` of
   `tools/games-host/package.json`, then `pnpm install`. (The assembler refuses unregistered games.)
4. **Write the rules as pure functions** in `src/logic.ts` — state in, state out; no DOM, no timers,
   no `Math.random` (take an `Rng`). Test them in `src/logic.test.ts`, including a random-play bot with
   `fast-check` that asserts the invariants of your game.
5. **Write the two stages** ([ADR 0020](../decisions/0020-a-game-has-a-menu-stage-and-a-play-stage.md)): `src/app.ts`
   connects (`connect({ gameId })`) and holds what both share (strings, sounds, the save and `persist()`);
   `src/main.ts` is the menu stage — the kit's `createShell` with the game's content and
   `stage: () => import('./stage.ts')`; `src/stage.ts` is the play stage — `start(ctx)` reads input, calls the
   logic, draws, and returns `pause`, `resume`, `newGame`, `leave` (free everything) and `quick` (the panel's live
   rows). Honour `muted`, `save` after every move and `submitScore` at the end of a round (a run saved mid-way reports
   with `session.run(id)`, ADR 0014). With both themes, follow `settings.theme` (`followTheme` from the kit) and keep
   a palette per theme for your art. [Game shell](../architecture/game-shell.md#kit) has the skeleton.
6. **Verify**:
   ```sh
   pnpm --filter @tohe/game-<id> test
   pnpm --filter @tohe/game-<id> typecheck
   pnpm --filter @tohe/game-<id> build
   pnpm --filter @tohe/game-<id> conformance    # then look at test-results/conformance/<id>*.png (one per theme)
   ```
7. **Play it** in the hub (`pnpm dev`, then rebuild `@tohe/games-host`) on a phone-sized window, then on a phone.
   Add `?perf` to the play page's address to see the frame rate there (the kit's `#perf` readout).

## Choosing technology

**Default: Phaser 4 through `@tohe/game-kit`** ([ADR 0012](../decisions/0012-phaser-and-the-game-kit.md),
[research](../research/game-tech.md)). `games/merge-block` is the reference: copy its `logic.ts` / `view.ts` /
`app.ts` / `main.ts` / `stage.ts` split.

| Game type | Choice |
| --- | --- |
| Puzzle, arcade, board, farm, RPG-lite | **Phaser 4 + game kit** (default) |
| Tiny one-screen games | TypeScript + Canvas 2D, like `games/hello` |
| UI-heavy (cards, words, quizzes) | DOM with the kit's `overlay`, `sfx`, `haptics` |
| Large game | Godot 4 web export, single-threaded build (no COOP/COEP needed) |

What the kit gives you, so you do not write it again: `createGame` (crisp on phones, resize, pause/resume, Canvas
fallback when WebGL fails), `sfx` (synthesised sounds, iOS unlock), `haptics`, `juice` (`popIn`, `squash`, `pulse`,
`burst`, `floatText`, `shake`, `confetti`), `drawTexture` + `crispImage` (art drawn once, see below), `overlay` (intro / pause / game-over cards in one shared style, on the
design tokens; `hintList` and `choiceList` for their content), `createShell` (the game shell, ADR 0018–0020: the menu stage —
title screen with play / continue, sound, settings and how-to screens, leaderboard, the way back to Tò He, the how-to
before a first game — and the play stage, loaded in the background and created on play, with ☰ and its quick panel
(resume, sound and the game's looks in place, a new game, the menu), phone Back, 3-2-1 for games against the clock,
the end-of-game card; every game uses it and declares `"shell"` in game.json), `createHud`
(☰ first, then the game's score, its own middle and the best score: counting up, a record lighting up, scores
shortened to fit), `bump`, `newRunId`, `followTheme` + `setBackground` (light/dark from the hub), `formatValue` / `formatScore`.

**Telemetry comes with it.** Pass the session's telemetry to the kit, `createGame({ …, telemetry: session.telemetry })`
and `createSfx({ telemetry: session.telemetry })`, and the game reports its renderer, frame times, first frame and
blocked audio; the SDK reports uncaught errors by itself. Add what only the game knows with
`session.telemetry.count('game.<id>.…')` or `.metric('game.<id>.…-ms', value)`, and list the name in
[Device telemetry](../architecture/telemetry.md). Never put anything about the player in a name.

**Draw once, not every frame.** Phaser redraws the scene up to 120 times a second on phones. A `Graphics` object
rebuilds its shapes on every one of those frames, and a `Text` redraws and re-uploads its canvas on every change.
Pieces that only change between moves (tiles, blocks with numbers, the board) are textures:
`drawTexture(scene, key, w, h, ctx => …)` once per look, put in the key, then `crispImage`. Keep `Graphics` for
things that really change shape every frame ([measurements](../research/game-tech.md)).

**Logic emits events, the view animates them.** `drop(state, column)` (or `move`, `place`…) returns the new state and
a list of events; the view turns each event into a short animation and never decides rules. Keep the PRNG state in
the game state, save after every move, and resume on open.

## Assets

- Prefer shapes, colours, emoji and numbers drawn in code — they are crisp at any size and weigh nothing.
- Third-party art must be CC0 (e.g. Kenney.nl) and copied into the game folder — never hot-linked.
- Synthesize sounds with Web Audio where possible; keep audio files short and compressed.

## Asking an agent to build a game

Use the `/new-game` skill, or give the agent this brief:

> Build a new Tò He game. Idea: «one paragraph». Follow docs/guides/create-a-game.md and
> docs/contracts/game-contract-v1.md. Start by writing games/<id>/SPEC.md and stop for review. Then implement
> it with pure logic + tests + a random-play bot, and finish only when `pnpm verify` passes and the conformance
> screenshot looks right.

## A game for several phones (online rooms)

A turn-based game played at a table online ([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md))
adds three things to the steps above; `games/tien-len` is the reference:

1. **A rules module**: `src/module.ts` exports `rules` with `setup`, `view`, `act`, `status`, `timeout` and `bot`
   ([the interface](../contracts/game-contract-v1.md#online-rooms)), built on the same pure logic the game uses
   against bots. A second Vite build (`vite.rules.config.ts`) writes it to `dist/rules.js`.
2. **`game.json`**: the `rooms` capability and block — seats, bot levels, and the house rules as options the hub
   draws.
3. **An online mode** in `stage.ts`: when `session.room` is set, draw the views it sends (animate their events), send
   actions with `session.room.act` and show a refusal's error code in words, and `next()` after a hand.

Conformance then checks the module the way the API runs it, and opens the game at a table refereed by it.
