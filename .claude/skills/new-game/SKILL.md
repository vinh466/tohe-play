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
3. **Stop and ask the user to review the spec.** Do not write code before they agree.

## 2. Build

1. Copy the structure of `games/merge-block` (package.json, tsconfig with `vite/client` types, vite.config with
   `base: './'`, index.html with a DOM HUD, `public/game.json`, `public/icon.svg` with a `<title>`). Set name
   `@tohe/game-<id>`, version `0.1.0`, capabilities, `themes`, `sizeBudgetKb` (≈ 2500 for a Phaser game).
2. Add `"@tohe/game-<id>": "workspace:*"` to `devDependencies` in `tools/games-host/package.json`; `pnpm install`.
3. `src/logic.ts`: pure functions returning **the new state and events**; no DOM/timers/`Math.random`; the PRNG
   state lives in the game state (see `random`/`spawn` in merge-block).
4. `src/logic.test.ts`: rule tests + a fast-check random-play bot asserting every invariant from the spec,
   deterministic replay, and save/restore round trip.
5. `src/view.ts`: a Phaser scene that only animates events — use the kit's `juice` (`popIn`, `squash`, `pulse`,
   `burst`, `floatText`, `shake`, `confetti`), `crispText`, `sfx` and `haptics`. Layout in CSS pixels.
6. `src/main.ts`: `connect({ gameId })`; `createGame({ createScene })` from `@tohe/game-kit/phaser` (handle
   `onRestart`); `pause`/`resume` → `kit.pause()/resume()`; `settings.muted` → `sfx.setMuted`; save after every move;
   `submitScore` at the end; intro/game-over with the kit's `overlay`; Vietnamese strings first, English second.
   Runs that outlast one sitting (saved mid-run): `createLifecycle` for "continue / new game" on open and the ⏸
   menu in the HUD, and live scores instead of `submitScore` — `session.run(id).update(score)` after scoring moves,
   `finish(score)` at game over and when a new game replaces an unfinished one (id kept in the save, ADR 0014).
7. Themes (with both): `followTheme(session, theme => { scene.setTheme(theme); kit.setBackground(...) })`; art
   colours in a per-theme palette (`palette.ts`), DOM colours from the design tokens (`var(--tohe-*)`); every text
   at least 4.5:1 on its background (3:1 if large and bold).

## 3. Verify

```sh
pnpm --filter @tohe/game-<id> test
pnpm --filter @tohe/game-<id> typecheck
pnpm --filter @tohe/game-<id> build
pnpm --filter @tohe/game-<id> conformance
```

Open `games/<id>/test-results/conformance/<id>*.png` (one per theme) and check the screens look right on a phone. Play it in the
hub (`pnpm dev`) on a phone-sized window. Then run `pnpm verify`. Report what you built, the screenshot path, and
anything in the spec you could not honour.
