---
title: Game Contract v1
description: Everything a game must do — and must not do — to run on Tò He, whatever it is written in.
sidebar:
  order: 1
---

The Game Contract is the only interface between a game and the platform. A game that honours it can be written
in anything that runs in a browser. The source of truth is
[`packages/contract/src`](../../packages/contract/src/index.ts); this page explains it. Changing the contract
requires an [ADR](../decisions/index.md) and a protocol version decision (see [Versioning](#versioning)).

## 1. Ship a build folder

A game is a folder of static files with a `game.json` next to the entry HTML:

```text
dist/
├── game.json        manifest (below)
├── index.html       entry
├── icon.svg         optional icon
└── assets/…
```

- All URLs must be **relative** (`./assets/x.js`): builds are served from `/<id>/<version>/`.
- The folder is published as an **immutable** build. A change means a new `version`.

## 2. The manifest — `game.json`

JSON Schema for editors: [`packages/contract/schema/game-manifest.schema.json`](../../packages/contract/schema/game-manifest.schema.json).

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `id` | string | — | `a-z`, digits, `-`; 3–40 chars. Equals the folder name under `games/`. Never changes. |
| `name` | string | — | Display name (≤ 40 chars). Vietnamese is fine. |
| `version` | semver | — | Bump for every published change. |
| `protocol` | `1` | — | Contract version the game speaks. |
| `description` | string | `""` | ≤ 200 chars, shown in the catalog. |
| `entry` | string | `index.html` | Entry file relative to the build folder. |
| `icon` | string | — | Icon file relative to the build folder (SVG or PNG, square). |
| `orientation` | `portrait` \| `landscape` \| `any` | `portrait` | Preferred orientation. |
| `capabilities` | array of `save`, `scores`, `rooms`, `shell`, `ranked` | `[]` | Platform services the game uses. Undeclared calls are rejected. `shell`: the game draws its own title screen and menu with the way back to Tò He (below). `ranked`: the server replays its runs (below). |
| `themes` | array of `light`, `dark` | `["light"]` | Looks the game has ([ADR 0013](../decisions/0013-light-and-dark-themes.md)). With both, it follows the hub through `settings.theme`; with one, it keeps that look. |
| `minAge` | 0–18 | `0` | Hidden from younger profiles (M1). |
| `tags` | string[] | `[]` | Up to 8 short tags. |
| `sizeBudgetKb` | integer | `3000` | Upper bound for the build size (source maps excluded). Conformance fails above it. |
| `rooms` | object | — | A game played online at a table ([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md)); required with the `rooms` capability, and only with it. See [Online rooms](#online-rooms). |
| `ranked` | object | — | A one-player game whose runs the server replays ([ADR 0030](../decisions/0030-ranked-runs-replayed-by-the-server.md)); required with the `ranked` capability, which needs `scores` too. See [Ranked runs](#ranked-runs). |

### Online rooms

A turn-based game for several phones declares `"rooms"` in `capabilities` and a `rooms` block. The hub draws the
lobby and the room screens; the API referees every action with the game's own **rules module**; the game sends
actions and draws the views it receives. Design: [Online rooms](../architecture/rooms.md).

| `rooms` field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `rules` | string | `rules.js` | ES module in the build that exports `rules` (below). |
| `seats` | `{ min, max }` | — | Players at a table, 2–8. |
| `bots` | string[] | `[]` | Bot levels the module plays (`a-z`), easiest first; empty if it has none. |
| `options` | array | `[]` | Up to 24 game options (house rules) the hub draws when a room is created: `boolean`, `choice` (one of `choices`) or `multi` (any of `choices`), each with `id`, `label: { vi, en }` and a `default`. |

The rules module is pure and deterministic — no DOM, timers, network, `Math.random` or `Date.now` (the API runs it in
Jint, where those throw) — and states, views and actions are JSON:

| Function | Returns |
| --- | --- |
| `setup({ seats, seed, options, carry })` | A hand's state. `options` are the room's game options by id; `carry` is the last hand's (null for the first). |
| `view(state, seat)` | What `seat` may see (`null`: a spectator). Never another seat's hidden cards. |
| `act(state, seat, action)` | `{ ok: true, state, events }` or `{ ok: false, error }` with an error code the game can put in words. |
| `status(state)` | `{ over: false, turn: [seat], chop: [seats that may act out of turn] }` or `{ over: true, result: { points, … }, carry }`; `points` add up on the room's score sheet. |
| `timeout(state, seat)` | What the turn timer plays. |
| `bot(state, seat, level, seed)` | A bot's action, or `null` (nothing out of turn). |

A rooms game also **replays** a finished hand ([ADR 0017](../decisions/0017-replays-of-finished-online-hands.md)):
opened with `init.replay` instead of `init.room`, it calls `setup` with the hand's seed, options and carry, then
`act` for each recorded action, and draws `view(state, seat)` for the seat that asked, with controls to step back,
forward, play and pause.

### Ranked runs

A one-player game whose logic is pure and seeded can let the server verify its runs: it declares `"ranked"` in
`capabilities` and a `ranked` block. Each ranked run starts from a seed the API deals and ends with the moves played,
which the API replays with the game's **verify module** — only a verified run counts on the server's board
([ADR 0030](../decisions/0030-ranked-runs-replayed-by-the-server.md), [Integrity and boards](../architecture/integrity.md#ranked-runs)).

| `ranked` field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `verify` | string | `verify.js` | ES module in the build that exports `verify` (below). |
| `board` | string | `default` | The board ranked runs count on. |
| `minMsPerMove` | 0–60000 | `100` | A person needs at least this long per move; a run faster than this, by the server's clock, is held for a person to look at. |
| `maxMoves` | 1–100000 | `20000` | Most moves a run can hand in. |

The verify module is pure and deterministic like a rules module — no DOM, timers, network, `Math.random` or
`Date.now` — and its moves are JSON:

| Function | Returns |
| --- | --- |
| `replay({ seed, moves })` | `{ score, over }` — the run's score, and whether it reached its end — or `{ error }` for a move that is not legal |
| `bot({ seed, moves })` | A legal next move, or `null` once the run is over; conformance plays runs with it |

The game's side, with the SDK:

```ts
const ranked = await session.ranked.start();     // { run, seed } — or null: offline, a guest, standalone
const game = newGame(ranked?.seed ?? localSeed);  // play from the server's seed, and keep every move (in the save)
// … at the end of the run, or when the player leaves it for a new one
if (ranked) await session.ranked.finish(ranked.run, moves, score);
```

Ask for a run when a new game starts, and wait only a moment (Ghép Khối waits 2.5 s) before playing unranked. Keep
the moves with the game's own state, so a run saved mid-way continues on any device. A run the game reports as a score
(`run(id)`) still counts on the account's board as before; the ranked run is what the public boards trust.

### Game shell

Every game has two stages — its own menu stage (the title screen, its option screens, the only way back to Tò He) and
a play stage with one ☰ whose quick panel pauses play ([ADR 0018](../decisions/0018-every-game-opens-on-its-own-main-menu.md),
[ADR 0019](../decisions/0019-game-shell-2-title-screen-hud-and-first-screen.md),
[ADR 0020](../decisions/0020-a-game-has-a-menu-stage-and-a-play-stage.md), [Game shell](../architecture/game-shell.md)).
A game declaring `"shell"` gets the whole screen: the hub draws no bar over it. The kit's `createShell` does all of
it (every game uses the kit, ADR 0012); what it does, and what any `shell` game must do:

- show its first screen and say so with `session.shell.menuChanged(…)` — the title screen (`true`), or play when
  opened straight into a table or a replay: the hub keeps its loading screen over the game until this first `menu`
  message, at most 8 s after the handshake;
- open on a title screen that runs nothing of the game (no board, no `<canvas>`), whose play button carries
  `data-tohe-play` and whose way back to Tò He carries `data-tohe-exit` and calls `exit()`; a first-time how-to before
  play carries `data-tohe-play` on its start button;
- while playing, show a ☰ (`data-tohe-menu`) that opens a panel pausing what can pause, with **no**
  `data-tohe-exit` — except at a table or in a replay, which have no title screen — and a way to the title screen
  marked `data-tohe-main-menu` (also on the end-of-game card), which saves the game and frees the play stage;
- on `menu` (the player pressed Back): open the panel while playing, close it when open, go to the title screen from
  the end of a game, and `exit()` from the title screen — telling the hub with `session.shell.menuChanged(open)`
  every time a menu or screen opens or closes;
- on `pause` (the hub hid the game): open the panel while playing alone, so play waits there; at a table nothing
  stops;
- offer sound (`session.shell.setMuted`), and the leaderboard or online play only when `session.shell.can` says the
  hub can open them (`session.shell.open('leaderboard' | 'rooms')`).

## 3. Runtime rules

A game **must**:

- call `connect()` (or speak the protocol below) and wait for `init` before starting;
- persist state **only** through `save()` — no `localStorage`, `IndexedDB` or cookies of its own (they are
  partitioned or wiped in an iframe and would not follow the player across devices);
- take randomness for gameplay from the `seed` (via `createRng(seed)`) when the result should be reproducible;
- stop the clock on `pause` and not lose progress;
- respect `settings.muted`;
- if `themes` lists both, follow `settings.theme`, including changes while playing (the hub's *Theo máy* can turn
  dark mid-round); a game with one look ignores it;
- keep its text readable: WCAG AA contrast (4.5:1, or 3:1 for large text) in every declared theme;
- work from 320 px wide, with touch, without hover, and with the safe-area insets of a notched phone.

A game **must not**:

- make any network request outside its own build folder: no CDNs, fonts, analytics, ads (the CSP blocks them);
- use `eval` or inline scripts (the CSP blocks them; WebAssembly is allowed);
- open pop-ups, navigate the top window, or link to other sites;
- assume it knows the hub's origin — it only ever replies to the window that sent `init`.

The CSP every game is served with is generated by `gameContentSecurityPolicy()` in
[`packages/contract/src/csp.ts`](../../packages/contract/src/csp.ts).

## 4. Using the SDK (TypeScript / JavaScript)

```ts
import { connect, createRng } from '@tohe/game-sdk';

const session = await connect<{ best: number }>({ gameId: 'merge-block' });
const rng = createRng(session.seed);

let best = session.saved?.best ?? 0;            // last save for this profile, or null
session.on('pause', () => game.pause());
session.on('resume', () => game.showResumeButton());
session.on('settings', (s) => audio.setMuted(s.muted));
// with "themes": ["light", "dark"]: s.theme is 'light' or 'dark' (game-kit: followTheme)

// at the end of a round
await session.submitScore(score);                // needs "scores" capability
await session.save({ best: Math.max(best, score) }); // needs "save" capability
session.exit();                                  // back to the catalog

// a run saved mid-way and resumed later (ADR 0014): one id per run, kept in the save
const run = session.run(saved.runId);
run.update(score);                               // after a move that scores: "in progress" on the leaderboard
run.finish(score);                               // at game over, or when the player starts a new game
```

| Member | Description |
| --- | --- |
| `mode` | `embedded` in the hub; `standalone` when the page is opened directly (local dev). |
| `profile` | `{ id, name, avatar? }` of the current player. |
| `locale` | `vi` or `en`. |
| `seed` | Integer; same for everybody on the same day. |
| `saved` | Last saved state or `null`. |
| `settings` | `{ muted, theme }`, kept up to date. `theme` is the hub's `light` or `dark`. |
| `on('menu', fn)` | The player pressed Back (shell games, ADR 0018, SDK 0.7.0). |
| `shell` | For `shell` games (SDK 0.7.0): `can` (`{ leaderboard, rooms }`: what the hub can open for this player), `menuChanged(open)`, `open('leaderboard' \| 'rooms')`, `setMuted(muted)` (updates `settings` at once). |
| `ranked` | For `ranked` games (SDK 0.8.0, [ADR 0030](../decisions/0030-ranked-runs-replayed-by-the-server.md)): `start()` → `{ run, seed }`, or `null` when the hub cannot open a run — play unranked; `finish(run, moves, score)` hands the run in (the hub keeps it until it is online). Standalone, `start()` is always `null`. |
| `on(event, fn)` | `pause`, `resume`, `settings`. Returns an unsubscribe function. |
| `save(data)` | JSON, ≤ 64 KB. Resolves when the hub stored it; rejects with the hub's reason. |
| `submitScore(value, board?)` | Finite number; board defaults to `default`. |
| `run(id, board?)` | A run that lasts across sittings: `update(value)` while it goes on, `finish(value)` when it ends. The hub keeps one score per run, its highest. |
| `exit()` | Ask the hub to close the game. |
| `log(level, message)` | Forward a diagnostic line to the hub's console; `warn` and `error` lines also reach [telemetry](../architecture/telemetry.md). |
| `room` | At an online table (ADR 0016, SDK 0.5.0), else `null`: `id`, `seat` (-1: spectator; may move between hands), `seats` (`{ profile, bot, connected, score }` in the rules module's order), `options`, `latest` (the newest view, which may arrive before the game listens), `onView(fn)` (`{ view, events, seq, turnMs }`; empty `events` after a reconnection: redraw), `onSeats(fn)`, `onReaction(fn)`, `act(action)` (rejects with the rules' error code), `next()` (ready for the next hand), `react(reaction)` (`wave`, `laugh`, `wow`, `clap`, `hurry`, `gg`, `sad`, `heart`; `REACTIONS` maps each to its emoji). |
| `replay` | A finished hand to replay (ADR 0017, SDK 0.6.0), else `null`: `seats` (as in `room`), `seat` (whose view to show), `seed`, `options`, `carry`, `actions` (`{ seat, action }` in order). Never together with `room`. |
| `telemetry` | Technical telemetry (ADR 0015, SDK 0.4.0): `count(name, n?)`, `metric(name, value)`, `error(error)`, `frames(summary)`, `flush()`, `enabled`. Uncaught errors are reported without calling it; pass it to the kit (`createGame({ telemetry })`, `createSfx({ telemetry })`) for frame times and renderer events. A no-op when the hub does not collect telemetry, and in standalone mode. |

In **standalone** mode (opening the game's dev server directly) the SDK fakes the host with `localStorage`, so a
game can be developed and tested on its own; `settings.theme` then follows the device's light/dark setting.

Games without a bundler load `tohe-game-sdk.iife.js` (built by `pnpm --filter @tohe/game-sdk build`) with a
`<script>` tag and use `window.Tohe.connect(...)`.

## 5. The protocol (for non-JavaScript engines)

Messages are plain objects sent with `postMessage`. Every message carries `tohe: 1`. JSON Schemas:
[`game-message`](../../packages/contract/schema/game-message.schema.json) and
[`host-message`](../../packages/contract/schema/host-message.schema.json).

| Direction | `type` | Fields | Notes |
| --- | --- | --- | --- |
| game → host | `ready` | `gameId`, `sdkVersion` | First message. Sent to `*` because the host is not known yet; carries no data. |
| host → game | `init` | `profile`, `locale`, `settings`, `save`, `seed`, `telemetry?`, `room?`, `replay?`, `shell?` | The game records `event.origin` and from now on only talks to it. `telemetry: true` asks for `telemetry` messages; absent (older hubs) means none. `room` (`id`, `seat`, `seats`, `options`) when opened at a table; `replay` (`seats`, `seat`, `seed`, `options`, `carry`, `actions` ≤ 5000) when opened to replay a finished hand. `shell` (`leaderboard`, `rooms`) for `shell` games: what the hub can open now. |
| game → host | `save` | `id`, `data` | Request; answered by `result`. |
| game → host | `score` | `id`, `value`, `board`, `run?`, `final` | Request; answered by `result`. `run` groups the reports of one run; `final` (default `true`) is `false` while it goes on. |
| host → game | `result` | `replyTo`, `ok`, `error?`, `value?` | Answer to a request; `value` is what it answers with — the run of `ranked.start`. |
| host → game | `pause` / `resume` | — | Tab hidden / shown, system dialogs. |
| host → game | `settings` | `settings` | `{ muted, theme }`: mute or theme changed. |
| game → host | `exit` | — | Close the game. |
| host → game | `menu` | — | Shell: the player pressed Back. |
| game → host | `menu` | `open` | Shell: the game's menu opened or closed — the answer to `menu`; without one (or `exit`) within 1.5 s the hub offers its own way out. |
| game → host | `open` | `what` | Shell: `leaderboard` (the hub's board over the game) or `rooms` (the game's lobby). |
| game → host | `settings` | `muted` | Shell: the player switched sound in the game; the hub remembers it for the device. |
| game → host | `ranked.start` | `id` | Ranked: request a ranked run as a new game starts; `result.value` is `{ run, seed }`, or the result is not ok and the game plays unranked. |
| game → host | `ranked.finish` | `id`, `run`, `moves` (≤ 100000, ≤ `ranked.maxMoves`), `score` | Ranked: request; the run ended, with its moves in order and the score reached. |
| game → host | `log` | `level`, `message` | Diagnostics. |
| host → game | `room.view` | `view`, `events` (≤ 200), `seq`, `turnMs` | Rooms: the seat's view after a change and the events since the last one; drop a `seq` lower than the newest. |
| host → game | `room.seats` | `seats`, `seat` | Rooms: the players changed; `seat` is this phone's. |
| host → game | `room.reaction` | `seat`, `reaction` | Rooms: a preset reaction. |
| game → host | `room.act` | `id`, `action` | Rooms: request; `result.error` is the rules' error code when refused. |
| game → host | `room.next` | `id` | Rooms: request; ready for the next hand. |
| game → host | `room.react` | `reaction` | Rooms: one of the preset reactions. |
| game → host | `telemetry` | `events` (1–50) | Only when `init.telemetry` is true. Events are `error` (`message`, `stack?`, `count`), `count` (`name`, `count`), `metric` (`name`, `value`) or `frames` (`buckets`, `slowestMs`, `stepP50Ms?`, `stepP95Ms?`, `renderer?`); names are lower-case words joined by dots. See [Device telemetry](../architecture/telemetry.md). |

## Conformance

A game is valid if and only if it passes the conformance kit:

```sh
pnpm --filter @tohe/game-<id> build
pnpm --filter @tohe/game-<id> conformance     # = tohe-conformance dist
```

The kit serves the build on its own origin **with the production CSP**, embeds it in a fake hub on a second
origin, and checks:

1. `game.json` is valid; entry and icon exist; the build fits `sizeBudgetKb`;
2. the handshake (`ready` → `init`) completes within 10 s;
3. the game survives 4 s of random taps (biased towards visible buttons) plus `pause`, `resume` and a settings
   change, which switches to a theme the game did not start in;
4. in every theme listed in `themes`, its text meets WCAG AA contrast (axe-core; text drawn on a canvas is not
   checked), and a game that lists both looks different in each;
5. no console errors or uncaught exceptions, no requests outside the game origin, no protocol errors;
6. with `init.telemetry` on, as in the hub, its `telemetry` messages stay within budget: about one a minute plus one
   per pause, each at most 8 KB;
7. with `rooms`: the rules module exists, is at most 256 KB and mentions no browser API, loads on its own with every
   platform function, plays bot tables of every declared size to the end (states, views and actions survive JSON;
   views at most 64 KB) with `Math.random` and `Date.now` throwing, and replays to the same state; then the game is
   opened at a two-seat table refereed by its own module, with a bot in the other seat, under random taps, and opened
   with `init.replay` to play back a hand its own bots played to the end;
8. with `shell`: it reports its first screen (a `menu` message) within 8 s of the handshake, opens on a title screen
   with `[data-tohe-play]` and `[data-tohe-exit]` and no `<canvas>` under it, plays from it (through a first-time
   how-to), answers `menu` with `menu { open: true }` within 1.5 s once playing and closes the panel on the next
   `menu`, opens its panel on `pause`, shows no `[data-tohe-exit]` over play, leads from the panel's
   `[data-tohe-main-menu]` to the title screen leaving no `<canvas>` behind, and the title screen's
   `[data-tohe-exit]` sends `exit`. The random input of check 3 starts from **Chơi**. Screenshots:
   `<id>-shell-title.png` (the title screen) and `<id>-shell.png` (the panel after Back).
9. with `ranked`: the verify module exists, is at most 256 KB and mentions no browser API, loads on its own with
   `replay` and `bot`, plays runs from three seeds with its own bot to the end (or `maxMoves`, at most 5000 here) with
   `Math.random` and `Date.now` throwing, replays each twice to the same score, and its moves survive JSON; under the
   random input of check 3 the game asks for a ranked run, and any run it hands in replays to the score it claimed.

It writes phone-sized screenshots to `test-results/conformance/`: `<id>.png` after the random input and
`<id>-<theme>.png` per theme, `<id>-room.png` at a table and `<id>-replay.png` replaying — look at them.

## Versioning

- `protocol` is an integer. Additive, optional changes (a new optional field, a new capability) keep the number.
  Example: `themes` and `settings.theme` (ADR 0013) — older builds ignore the field; SDK 0.2.0 assumes `light` when
  a host does not send it. Likewise `run` and `final` on `score` (ADR 0014): a score without them is final, as in
  older builds; `rooms` (ADR 0016), a capability older games do not declare; and `init.replay` (ADR 0017), sent only
  to games that declare `rooms`; `shell` (ADR 0018), its messages and `init.shell`, which only `shell` games send or
  get; `ranked` (ADR 0030), its block and messages, and `result.value` — an older hub refuses `ranked.start`, so the
  game plays unranked.
- Anything a v1 game could trip over is a new protocol number. The hub then supports **N and N−1** side by side;
  games are migrated before N−1 is dropped.
- The SDK follows semver independently; its major version changes only with the protocol.
