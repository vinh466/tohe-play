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
5. **Write the view** in `src/main.ts` (or a framework of your choice): read input, call the logic, draw. Connect
   with `connect({ gameId })`, honour `pause` and `muted`, `save` and `submitScore` at the end of a round. With
   both themes, follow `settings.theme` (`followTheme` from the kit) and keep a palette per theme for your art.
6. **Verify**:
   ```sh
   pnpm --filter @tohe/game-<id> test
   pnpm --filter @tohe/game-<id> typecheck
   pnpm --filter @tohe/game-<id> build
   pnpm --filter @tohe/game-<id> conformance    # then look at test-results/conformance/<id>*.png (one per theme)
   ```
7. **Play it** in the hub (`pnpm dev`, then rebuild `@tohe/games-host`) on a phone-sized window, then on a phone.

## Choosing technology

**Default: Phaser 4 through `@tohe/game-kit`** ([ADR 0012](../decisions/0012-phaser-and-the-game-kit.md),
[research](../research/game-tech.md)). `games/merge-block` is the reference: copy its `logic.ts` / `view.ts` /
`main.ts` split.

| Game type | Choice |
| --- | --- |
| Puzzle, arcade, board, farm, RPG-lite | **Phaser 4 + game kit** (default) |
| Tiny one-screen games | TypeScript + Canvas 2D, like `games/hello` |
| UI-heavy (cards, words, quizzes) | DOM with the kit's `overlay`, `sfx`, `haptics` |
| Large game | Godot 4 web export, single-threaded build (no COOP/COEP needed) |

What the kit gives you, so you do not write it again: `createGame` (crisp on phones, resize, pause/resume, Canvas
fallback when WebGL fails), `sfx` (synthesised sounds, iOS unlock), `haptics`, `juice` (`popIn`, `squash`, `pulse`,
`burst`, `floatText`, `shake`, `confetti`), `overlay` (intro / pause / game-over cards in one shared style, on the
design tokens), `followTheme` + `setBackground` (light/dark from the hub), `formatValue` / `formatScore`.

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
