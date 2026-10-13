---
name: new-game
description: Create a new Tò He game from an idea — spec first, then pure logic with tests and a random-play bot, then the view, finishing only when conformance passes. Use when asked to build, add or prototype a game.
---

# New game

Input: a short idea, and optionally an id. Follow `docs/guides/create-a-game.md` and
`docs/contracts/game-contract-v1.md`; `games/hello` is the reference implementation.

## 1. Spec — then stop

1. Pick an id: lowercase, dashes, 3–40 chars, not used under `games/`.
2. Write `games/<id>/SPEC.md` in the shape of `games/hello/SPEC.md`: rules, screens, what is saved, what is
   scored, how a round ends, invariants the bot must check, and the chosen technology if not Canvas 2D.
3. **Stop and ask the user to review the spec.** Do not write code before they agree.

## 2. Build

1. Copy the structure of `games/hello` (package.json, tsconfig, vite.config with `base: './'`, index.html,
   `public/game.json`, `public/icon.svg` with a `<title>`). Set name `@tohe/game-<id>`, version `0.1.0`,
   capabilities, a realistic `sizeBudgetKb`.
2. Add `"@tohe/game-<id>": "workspace:*"` to `devDependencies` in `tools/games-host/package.json`; `pnpm install`.
3. `src/logic.ts`: pure functions, no DOM/timers/`Math.random` — randomness from `createRng(seed)`.
4. `src/logic.test.ts`: rule tests + a fast-check random-play bot asserting every invariant from the spec.
5. `src/main.ts`: view and input; `connect({ gameId })`; honour `pause`, `resume`, `settings.muted`; `save` and
   `submitScore` at the end of a round; Vietnamese strings first, English second.

## 3. Verify

```sh
pnpm --filter @tohe/game-<id> test
pnpm --filter @tohe/game-<id> typecheck
pnpm --filter @tohe/game-<id> build
pnpm --filter @tohe/game-<id> conformance
```

Open `games/<id>/test-results/conformance/<id>.png` and check the screen looks right on a phone. Then run
`pnpm verify`. Report what you built, the screenshot path, and anything in the spec you could not honour.
