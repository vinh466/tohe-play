# R-04 — The save, the ranked boundary and the contract for the new layers

Status: research note for [D-12](../items/D-12-contract.md). Date: 2026-11-08.

## The question

Orders, parts, the Workshop, the Daily and Zen need new state, a new version and new screens; the
platform's ranked verifier replays the game's own logic from a seed and a list of moves, the
challenge entry carries a seed/score, and the leaderboard shows live scores. Which of the new
layers can be ranked, what must stay unranked, and what exactly is saved and versioned?

## Facts from the code and the contract

- The game state is `version: 2` (grid, current/next, score, best, moves, rng, seed, pressure,
  shipped, biggestShipped). `restore()` rejects anything else; old v1 saves start a new game.
- The ranked run is `{ run, seed, moves: number[] }`; the API replays the seed + columns with
  `src/verify.ts`/`logic.ts`; the moves stay a list of columns, and the pressure/shake/ships are
  derived. The classic game is the ranked one. `game.json` declares `ranked.verify`, the board,
  `minMsPerMove`, `maxMoves`.
- The scores: a live run `session.run(id).update(score)` after each move; `finish(score)` at the
  end or a new game; the account's board.
- The challenge: `{ v: 2, seed, score }`; `readEntry` is strict; the challenge slot is saved beside
  the regular game; never ranked.
- The shell entry, the save, the share, the console/replay, the profiles and the child's board are
  all platform-level; the game never calls the API directly.

## The layers and the ranked boundary

| Layer | Changes the rules? | Could be ranked? | Recommendation |
|---|---|---|---|
| Classic (today) | No | Yes, today | **Ranked, unchanged**; the reference |
| Orders | No rule change; a goal wrapper + the parts | The parts change the state (pressure, chute, etc.); the verifier would need them in the moves | **Unranked**; the parts' seed/choices are in the save but not the ranked run |
| Parts | Yes (pressure max, ship value, sorter, etc.) | Only with a contract/verify change (the parts in the move log) | **Orders only, unranked**; the classic never uses them |
| Workshop stat sidegrades | Yes (would make the classic easier) | No, unless the ranked run carries the build | **Orders only**; cosmetics may apply everywhere (they do not change the rules) |
| Daily | No rule change; a fixed seed per day | The server would need the day/seed/timezone; the verifier could replay the seed | **Unranked** in the first slice; a server board is a later ADR/API slice (D-05) |
| Zen | Yes (pressure/jam off) | No | **Unranked**; a separate flag; no score/live run |
| Challenge | No | No (today's challenge is unranked) | Keep; the daily share may need `v: 3` (mode + seed + score) |
| Cosmetics (palette, machine skin, chute) | No | Yes (they are visual) | Apply everywhere; saved per profile; the ranked classic keeps the same logic |

## Save shape (proposal for D-12)

The `Saved` grows (version 3):
```ts
interface Saved {
  best: number;
  game: State | null;             // the classic/in-progress run (version 3 state)
  tutorialSeen: boolean;
  run?: string;
  palette?: PaletteId;
  ranked?: RankedProgress;        // classic only
  challenge?: ChallengeSlot;      // today's challenge slot
  workshop?: { scrap: number; xp: number; level: number; blueprints: string[]; cosmetics: string[] };
  orders?: { seed: number; orders: OrderState[]; parts: PartId[]; scrap: number; xp: number; finished: boolean };
  daily?: { date: string; seed: number; score: number; streak: number; lastDay: string | null };
  zen?: boolean;                  // the last mode? no; the mode is chosen per run
}
```
The exact fields are D-12's job; the principles:
- The **classic `game`/`State`** keeps its shape and semantics; the new modes are separate slots, so
  the classic ranked run and its `moves` never see the parts.
- The **orders run** is its own seed + state + parts + orders; the `State` may be the same shape
  plus a mode/part context, or a wrapper; the verifier never replays it.
- The **daily** is a slot keyed by the local date (the game derives the seed from the date at stage
  start; the logic stays pure; the date string is passed in, never `Date.now` in the logic).
- The **workshop** is per profile; the cosmetics are strings; the scrap/XP/level; the blueprints.
- The **migration** from v2: the classic game/best/ranked/challenge stay; the new fields default;
  a v2 save is upgraded on read (or start a fresh orders/daily/workshop, keep the classic).
- The **save size**: small (the state ~1 KB; the new fields small); the 1 MB limit is far away.

## The challenge/entry version

- Keep `v: 2` for the classic challenge (seed + score).
- A daily share needs `v: 3` (or a `kind`): `{ v: 3, seed, score, mode: 'daily', date? }`; the game's
  entry handler accepts it only if the seed/score/date are valid; the shell answers `unsupported`
  for a newer version. The daily share is a "same blocks, beat me today" card; the date is the
  sender's local date, shown as such (not a server-authoritative claim).
- The server board for the daily: **not in the first slice**; it needs a board id/period, a
  timezone rule, an integrity/anti-cheat story and an API/ADR; D-05 decides.

## The scores and the live run

- The classic: unchanged (a live run, `finish`).
- The Orders: a score run? The recommendation: **no live ranked run**; the local save; the
  ticket; the scrap/XP; the share is the challenge-style link. If the family wants the Orders on
  the leaderboard, it needs a separate board and a verifier (the parts in the moves) — a later ADR.
- The Daily: a local score/streak; the share; no live run/server board in the first slice.
- Zen: no score; no run.

## Recommendation

**Save v3 with separate slots; the classic ranked untouched; the Orders/Daily/Zen unranked; the
cosmetics global; the stat parts Orders-only; the daily local-first; the challenge v2 kept, the
daily share v3.** This keeps the integrity engine honest and the family's leaderboard meaningful
(the classic scores stay comparable), at the cost of the Orders/Daily not appearing on the
server boards until a later, explicit ADR/API slice. The verifier/conformance/API tests continue to
cover the classic; the new modes get unit/view tests and an explicit "unranked" label in the UI.

## What would change my mind

- The owner wants the Orders on the family leaderboard: then the parts must be logged in the moves
  and the verifier extended; that is a contract/ADR decision (T3) and a larger slice.
- The daily is the main retention bet: a server-side daily board may be worth the API/ADR now;
  the local-first daily is the cheaper test.
- The workshop meta is meant to be deep: the save/state may need a real schema and migration; the
  v3 proposal is the light version.

## Sources

`games/merge-block/src/logic.ts`, `src/verify.ts`, `src/app.ts`, `src/challenge.ts`, `public/game.json`;
`docs/contracts/game-contract-v1.md`; ADR 0014 (live scores), 0030 (ranked/verify), 0032 (replay),
0045 (entries/challenge), 0041 (release). Checked 2026-11-08.
