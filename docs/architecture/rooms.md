---
title: Online rooms
description: How players on different phones sit at one table — the lobby, rooms, codes and share links, seats and bots, reconnection — as a platform feature every turn-based game reuses.
sidebar:
  order: 7
---

> **Status: built, [phases](#phases) 1–3** ([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md),
> replays: [ADR 0017](../decisions/0017-replays-of-finished-online-hands.md)); tables open to device profiles
> ([ADR 0043](../decisions/0043-device-profiles-and-identity-levels.md), step I2a — [Who may sit](#who-may-sit)).
> The owner accepted the proposed answers to the [open questions](#decisions-on-the-proposals-open-questions).
> Technology and evidence: [Online rooms research](../research/online-rooms.md). First game: Tiến Lên
> ([research](../research/tien-len.md), [SPEC](../../games/tien-len/SPEC.md)).

## Why

The owner wants to play Tiến lên miền Nam with other people on the platform, each on their own phone: a list of
public rooms, private rooms, a code to type or a link to share, and room options such as bots for empty seats. The
flow should be built once, properly, so that later turn-based games (Cờ caro, Phỏm, Cờ tướng…) get it for free.

## Principles

1. **The platform owns the room; the game owns the table.** Lobby, codes, links, seats, bots, timers and reconnection
   live in the hub and the API. A game brings its rules and draws its table.
2. **The server decides.** The API deals and validates every action. A phone receives only what its seat may see:
   never the state, never the seed.
3. **One rules module per game.** The same `rules.js` from the game's immutable build runs on the phone (hints,
   offline bots) and in the API (the referee).
4. **Phones come and go.** Locking the screen, switching network or taking a call is the normal case. Every
   (re)connection receives a full snapshot of the seat's view, so a lost message never matters.
5. **Safe for children.** No free chat (preset reactions only), no money or chips, names and avatars only, and a
   child plays with other accounts — or device profiles — only behind the account owner's switch.
6. **Offline still plays.** Without a connection a game offers "Chơi với máy": the same rules against bots on the
   phone.

## Words

| Word | Vietnamese in the UI | Meaning |
| --- | --- | --- |
| Room | Bàn | A table for one game: seats, options, a code, a host. Lives from creation until the last person leaves. |
| Seat | Ghế | A place at the table: empty, a profile — an account's, or a device profile on the server (ADR 0043) — or a bot. |
| Host | Chủ bàn | The profile that created the room, or the one it passed to. Changes options, adds bots, starts, removes players. |
| Hand | Ván | One deal played to the end. |
| Series | Bảng điểm | The running score of a room across its hands. |
| Spectator | Người xem | Watches public information only (if the room allows). |
| Invitation | Lời mời | A player asks another profile to the table — of their account, or another account's found by its 12-digit ID, as its owner allows ([ADR 0033](../decisions/0033-invite-a-profile-by-its-id.md)); it shows on that profile's catalog for 10 minutes. |
| Replay | Xem lại | A finished hand played back in the game, for the people who played it. |
| Code | Mã bàn | 6 digits, unique among open rooms. |
| Link | Link mời | `https://<hub>/r/<code>`: the same code, one tap. |

## A room's life

```mermaid
stateDiagram-v2
  [*] --> Waiting: host creates
  Waiting --> Playing: host starts (or everyone ready)
  Playing --> BetweenHands: hand over
  BetweenHands --> Playing: next hand (all ready or countdown)
  BetweenHands --> Waiting: seats change / options change
  Waiting --> Closed: last person leaves, or idle 30 min
  BetweenHands --> Closed: last person leaves, or idle 30 min
  Playing --> Closed: every human gone longer than the grace period
  Closed --> [*]
```

- A room closes when no human is left; bots never keep a room open. Its code is not given out again for a day
  (`Rooms:ClosedCodeReserved`), so an old link never opens a stranger's table ([Entry links](entry-links.md#rooms-a-closed-tables-code)).
- The host role passes to the longest-seated human when the host leaves.
- Seats can change only while `Waiting` or `BetweenHands`; a player who leaves mid-hand is replaced by a bot
  for the rest of that hand (if the room allows bots) or the hand ends for everybody (if not).

## Flows

### 1. The lobby

The lobby is a hub page (`/play/<game>/rooms`). The game's catalog card opens the game on its main menu, whose **🌐 Chơi online** leads here, and the lobby's ← goes back to it ([Game shell](game-shell.md), ADR 0018):

```text
┌──────────────────────────────┐
│  Tiến Lên                    │
│  [ ⚡ Chơi nhanh ]            │  join the fullest public room waiting for players, or create one
│  [ ＋ Tạo bàn ] [ # Nhập mã ]│
│  [ 🤖 Chơi với máy ]          │  offline: the game alone, against bots on this phone
│                              │
│  Bàn đang mở               │  public rooms, live (SignalR), newest first
│  🐯 Ba · 2/4 · đang chờ   ›  │
│  🐼 Mẹ · 4/4 · đang chơi  👁 │  👁 = spectators allowed
└──────────────────────────────┘
```

### 2. Creating a room

The host picks the options (below) and lands in the waiting room as seat 1. Defaults come from the host's last room
for that game, so creating the next room is one tap.

### 3. The waiting room

```text
┌──────────────────────────────┐
│  Bàn 482 913      [Chia sẻ]│  code large enough to read across a table
│  ▓▓ QR ▓▓                     │  scanned by another phone in the same room
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│  │🐯 Ba│ │🐼Mẹ│ │ ＋ │ │🤖  │ │  ＋ = empty: invite, or host adds a bot
│  │chủ │ │ ✓  │ │    │ │ Vừa│ │  ✓ = ready
│  └────┘ └────┘ └────┘ └────┘ │
│  Luật: chặt heo, thối 2, 20 s │  options summary; host taps to change
│  [ Bắt đầu ]                  │  host only, from 2 seats taken
└──────────────────────────────┘
```

- **Chia sẻ** uses the Web Share API (Zalo, Messenger, SMS on the phone) with the link and a line of text. Browsers
  only offer it, and the Clipboard API, on HTTPS: on the home server's plain HTTP the button copies the text and the
  link the old way and says so.
- **QR** encodes the link, for family sitting together.
- The host can add or remove a bot per seat, remove a player, change options, pass the host role, or lock the room
  (nobody new may join).

### 4. Joining with a code

A 6-digit field with the numeric keypad (`inputmode="numeric"`), pasting allowed, spaces ignored, submitted when the
sixth digit is typed. The answer is the room's preview, or one of the messages in [When joining fails](#when-joining-fails).

### 5. Joining with a link

A table's link is one kind of entry, and a table's six digits typed into "Nhập mã" are the same: the hub's entry
pipeline keeps it through signing in and the `named` screen, looks the code up only after that gate, and ends a code
with no table — never used, or closed — at "Mã này không mở được nữa". That pipeline, and the card a chat app shows for
the link — naming no one, and the game only for a table listed publicly — are in [Entry links](entry-links.md).

```mermaid
sequenceDiagram
  actor P as Player
  participant H as Hub
  participant API

  P->>H: opens /r/482913 (from Zalo, QR, browser)
  alt not signed in on this device
    H->>P: plays as the device profile: the named screen the first time — a name, an avatar, the terms line (ADR 0043)
    H->>API: POST /api/devices, POST /api/devices/profiles — then every request names it (X-Tohe-Device-Profile)
  else signed in, no profile chosen
    H->>P: "Ai đang chơi?" — the entry kept on this tab for an hour, then back to /r/482913
  end
  H->>API: GET /api/rooms/code/482913
  API-->>H: preview: game, host, seats, options, state
  H->>P: "Vào bàn của Ba?" [Vào ngồi] [Xem]
  P->>H: Vào ngồi
  H->>API: POST /api/rooms/{id}/seats (rate limited)
  API-->>H: seat 3
  H->>P: waiting room, or the table if a hand is between deals
```

- A phone with no account sits as its device profile — after the `named` screen the first time
  ([Who may sit](#who-may-sit)). Signing in instead ("Đã có tài khoản? Đăng nhập", "Nhờ bố mẹ") keeps the way back.
- The way back survives signing in, registering and the profile picker: the page that needs a player remembers its
  path in `sessionStorage` (`session/next.ts`, paths of the hub only), and the profile picker goes there instead of
  the catalog.
- On iOS a link opens in Safari, not in the installed PWA; the session cookie of the PWA is separate
  ([ADR 0004](../decisions/0004-identity-households-and-profiles.md)), so the player may sign in once in Safari.
  Android Chrome can open links in the installed app.
- The link works for anyone who can reach the hub: the family's VPN on UAT, anyone on the internet in production
  ([ADR 0021](../decisions/0021-release-production-through-the-tohe-chart.md)).

### When joining fails

| Case | What the player sees | Offered |
| --- | --- | --- |
| No room with that code | "Không tìm thấy bàn 482 913" | Try again, lobby |
| Room full | "Bàn đã đủ người" | Watch (if allowed), lobby |
| Hand in progress, no free seat | "Ván đang chơi" | Watch, or sit at the next free seat between hands |
| Room locked by the host | "Chủ bàn đã khóa bàn" | Lobby |
| Child profile, another account, switch off | "Cần chủ tài khoản cho phép chơi với người ngoài" | Lobby |
| Child profile, switch off, a device profile at the table — or a device profile, such a child at the table | the same | Lobby |
| Device profile, a table for accounts only | "Bàn này chỉ dành cho người có tài khoản Tò He" | Sign in |
| Game hidden for this profile's age | "Trò này chưa dành cho bạn" | Catalog |
| Offline or API down | "Cần mạng để chơi online" | Chơi với máy |
| Already seated in this room on another device | Takes the seat over on this device; the other device shows "Đang chơi ở máy khác" | — |
| Too many wrong codes | "Thử lại sau một phút" | — |

### 6. At the table

- The game is launched in the iframe with the room in `init`; from then on the hub relays views and actions.
- **Turn timer** (option): the active seat's avatar shows a ring; at zero the platform asks the rules for the
  timeout action (Tiến lên: pass, or play the lowest legal card when leading).
- **Disconnects:** the seat shows "mất kết nối"; after the grace period a bot plays it (if bots are allowed) and the
  player takes it back the moment they return. Without bots, the timer keeps passing for them.
- **Reactions:** 😀 in the game's HUD opens a fixed set of eight (👋 Chào cả nhà!, 😂 Haha!, 👏 Hay quá!, ⏰ Nhanh lên
  nào!…), at most one every 1.5 s per seat; they appear as a bubble at the seat. No typed text.

### 7. Between hands

Results (places, penalties, points), the series score, then the next hand when everyone taps **Ván tiếp** or after a
countdown. Players can leave; the host can change seats and options; empty seats can take a bot or a newcomer.

### 8. Watching

When the host allows it (**Cho người khác vào xem**, off by default), a room is marked 👁 in the lobby. Tapping a
full or locked table watches it instead of joining; a code or link preview offers **👁 Xem** next to joining. The same doors apply as for sitting (account-only, the parent switch). A spectator gets the view
of seat `null`: the table, card counts and places, never a hand; the waiting room says **Bạn đang xem bàn này**,
and the game hides its buttons and reactions. Leaving gives up nothing.

### 9. Inviting players

**Mời người chơi** in the waiting room lists the account's other profiles that are not at the table, and finds any
profile by its 12-digit ID ([ADR 0033](../decisions/0033-invite-a-profile-by-its-id.md)). The phone checks the ID's
Damm digit first, so a mistyped digit or two swapped neighbours say "ID không đúng" at once; **Tìm** then shows the
profile's card — avatar, name, ID — and only **Mời {name}** on that card asks it: a free name never misleads. An
invitation shows as a banner on that profile's catalog (checked every 20 s) with **Vào bàn**, which opens the room's
preview. It lasts 10 minutes, opens a locked room for that profile, and never gets round the parent switch or a full
table. Invitations live in the room's memory: an API restart forgets them.

Beyond the account, the invited profile's owner decides who may ask it (`invites`, in Quản lý tài khoản): **Mọi người
có ID** (adults, by default), **Người từng chơi cùng** — someone it sat at a finished hand with — or **Chỉ trong tài
khoản**. A child is always the last, and its ID is not found from outside its account, nor is a profile of a suspended
account. A table kept to the account takes nobody else. An account looks up 20 IDs an hour, found or not
(`Identity:ProfileLookupsPerHour`), asks 20 profiles of other accounts an hour (`Rooms:InvitationsPerHour`), and 10
invitations from other accounts wait for one profile at most (`Rooms:InvitationsWaitingPerProfile`).

```mermaid
sequenceDiagram
  autonumber
  actor A as Player at the table
  participant H as Hub
  participant R as Rooms (API)
  participant I as Identity (API)
  actor B as Invited profile
  A->>H: Mời người chơi → 12 digits → Tìm
  H->>H: Damm check digit — wrong: "ID không đúng", nothing sent
  H->>I: GET /api/profiles/by-id/{publicId}
  I->>I: count the lookup — over the hour's share: 429 lookup_limit
  alt none, a child of another account, a suspended account
    I-->>H: 404 profile_not_found — the same answer for all three
  else found
    I-->>H: the card — avatar, name, ID
    A->>H: Mời {name}, on the card
    H->>R: POST /api/rooms/{id}/invite { profileId }
    alt another account
      R->>I: the profile, as this account may find it — gone since: 404 profile_not_found
      R->>R: a table kept to the account: 403 room_account_only
      R->>R: its setting — account, or played-with with no hand together: 403 invites_closed
      R->>R: 10 invitations already waiting for it: 429 invitee_limit
      R->>R: 20 asked this hour: 429 invite_limit
    end
    R->>R: the invitation, 10 minutes
    R-->>H: 204
    B->>R: GET /api/rooms/invites (every 20 s)
    R-->>B: the banner — Vào bàn opens the preview
  end
```

### 10. Results and looking back

The lobby shows the active profile's own results in the game (hands, wins, points: all time and this week — from
Monday 00:00 in Việt Nam), the account's board of the week from the integrity engine
([Integrity and boards](integrity.md)), and its last 20 hands. **Xem lại** opens a hand in the game, which deals
it again from its seed with its own rules module and plays it back from the player's seat: back, forward, play and
pause ([ADR 0017](../decisions/0017-replays-of-finished-online-hands.md)). A hand played with an older version than
the catalog's says it cannot be replayed: the games image only holds current builds.

A player whose profile was deleted since keeps their seat in the hands they finished, for the others who played them
([ADR 0034](../decisions/0034-delete-accounts-and-profiles-for-good.md)): the seat carries a fresh random id and
`Deleted: true` — no account, name or avatar — and a replay shows it as **Người chơi đã xoá**. Their results keep the
place and points with no profile, so a hand still counts its players. A deleted profile, or one whose account waits to
be deleted, leaves the tables it sits at or watches at once — a bot finishes a hand in progress — and invitations to it
end.

## Options

**Platform options** (every online game):

| Option | Choices | Proposed default |
| --- | --- | --- |
| Visibility | Public (in the lobby list) / private (code or link only) | Public |
| Who may join | "Ai có link cũng vào" — anyone named, a device profile too / "Chỉ tài khoản" / "Chỉ hồ sơ trong tài khoản tôi" ([below](#who-may-sit)) | Ai có link cũng vào |
| Seats | The game's range (Tiến lên 2–4) | 4 |
| Bots fill empty seats at start | On / off | On |
| Bot level | The game's levels (Dễ, Vừa, Khó) | Vừa |
| Bot takes over a disconnected player | On / off | On |
| Turn timer | Off / 15 / 20 / 30 / 60 s | 20 s |
| Spectators | On / off | Off |
| Start | Host taps start / starts when every seat is ready | Host |

**Game options** are declared by the game in `game.json` (choices and defaults) and validated by its rules module;
the hub draws the form, so no game builds its own room screen. Tiến lên's house rules:
[Tiến lên research](../research/tien-len.md#house-rules).

## Who may sit

[ADR 0043](../decisions/0043-device-profiles-and-identity-levels.md): an online table asks for at least `named` — a name
others see — and its creator may ask for more. A table's **entry** (`entry` in the API):

| Entry | In the UI | Who sits |
| --- | --- | --- |
| `named` | Ai có link cũng vào | Anyone with a profile: an account's, or a device profile on the server. **The default** for a new table |
| `account` | Chỉ tài khoản | Profiles of accounts; a device profile hears `403 account_required` |
| `own` | Chỉ hồ sơ trong tài khoản tôi | The host's account's profiles (`room_account_only`) |

Tables opened before I2a kept their door: "my account's profiles only" became `own`, the others `account`.

- **A device profile acts with its device's key** ([Identity](identity.md#device-profiles-on-the-server)): the hub names
  it in `X-Tohe-Device-Profile` on every rooms request and in the rooms hub's address, with the terms version it shows
  (`X-Tohe-Terms`); the API's players' scheme then reads the device key and nothing else. Its copy on the server is made
  first, after the `named` screen; `412 terms_required` and `404 device_profile_not_found` send the hub back there or to
  a new id.
- **What it may do**: everything a player does at a table — the lobby, quick play, a code or a link, sitting, watching,
  playing, its results and replays — and open a table of its own, always `named`. It asks nobody by ID, and nobody finds
  it by one: it has none (`account_required`).
- **Children**: a child whose "Chơi online với người ngoài" is off sits only at tables kept to its account, and never
  with a device profile — a device profile is always an outsider. The table checks both ways, seated or watching: such a
  child does not come in where a device profile is, nor a device profile where such a child is, whatever the host opens
  the door to later (`parent_permission`). For a device profile coming in, the table reads the children's switches as
  their accounts say now, not as they were when they sat. Turning a child's switch off takes it off any table that is
  not kept to its account.
- **A new door holds for those in**: when the host changes the entry, whoever it would not let in leaves — a device
  profile from a table for accounts, another account's profile from one kept to the host's account — seated or
  watching. The host role passes with its account: "the host's account" is the new host's; a device profile hosting has
  none, so its table stays `named`.
- **Results**: a device profile's result of a hand is recorded like anyone's — `rooms.results` without an account — and
  goes to the integrity engine marked `device_earned`: it counts in its own statistics and replays, never on a public
  board ([Integrity](integrity.md#public-boards)). Brought into an account, its results follow its id and stay marked;
  merged into an account's profile, they move to it and a [merge alias](identity.md#merge-aliases) keeps the old id
  reachable. Moved to another device with a [transfer code](identity.md#the-transfer-code), it leaves its tables (a bot
  finishes a hand) and its seats and results stay its own; its old device acts for it no more
  (`410 device_profile_moved`). A profile withdrawn from a table — moved, deleted, brought into an account — takes its
  phones out of the room's groups (`room:{R}` and `room:{R}:{P}`), so a phone it left receives nothing of its seat even
  should it sit there again from another device; `Exit` needs no profile that still acts.
- **Moderation**: the console takes any profile off its tables — a bot finishes a hand in progress — and renames a
  device profile ([Admin console](admin.md#users)).

## Who sees what

| Data | Seen by |
| --- | --- |
| A seat's hand | That seat only; once the hand is over, the people who played it (its replay carries the seed) |
| Card counts, the table, passes, places | Everyone at the table and spectators |
| A finished hand: seats, seed, actions, result | The profiles that played it — not spectators |
| Personal results and the account's board | The profile itself; the account's profiles on the board |
| Profile name and avatar | Everyone in the room, and the lobby list (host only) |
| Account, age band | Nobody else — the server uses the age band to filter, never shows it |
| The deck and seed | The server only |

Playing with another account shows a child's profile name and avatar to people outside the account; that is why
the parent switch exists.

## The contract

Game Contract v1, additively (protocol 1, like `themes` and `telemetry`): a game without `rooms` is untouched. Full
reference: [Game Contract v1](../contracts/game-contract-v1.md).

**Manifest:** the `rooms` capability and block go together (Tiến Lên's, abridged):

```jsonc
{
  "capabilities": ["save", "rooms"],
  "rooms": {
    "rules": "rules.js",                 // ES module in the build, exporting `rules`
    "seats": { "min": 2, "max": 4 },
    "bots": ["easy", "normal", "hard"],  // easiest first; the middle one is the default
    "options": [                          // the hub draws these when a room is created
      { "id": "chopChain", "type": "boolean", "label": { "vi": "Chặt chồng", "en": "Stacked chops" }, "default": true },
      { "id": "points", "type": "choice", "label": { "vi": "Tính điểm", "en": "Points" },
        "choices": [{ "id": "full", "label": {…} }, { "id": "places", "label": {…} }], "default": "full" },
      { "id": "instantWins", "type": "multi", "label": {…}, "choices": [{ "id": "dragon", "label": {…} }, …],
        "default": ["dragon", "fourTwos", "fivePairs", "sixPairs"] }
    ]
  }
}
```

**Protocol:**

| Direction | `type` | Fields | Notes |
| --- | --- | --- | --- |
| host → game | `init` | `room?: { id, seat, seats, options }` | Present at a table. `seat` is this phone's (-1: spectator); `seats` are `{ profile, bot, connected, score }` in the rules module's order. |
| host → game | `room.view` | `view`, `events`, `seq`, `turnMs` | The seat's whole view after a change, the public events since the last one (empty after a reconnection: redraw), and the turn timer. |
| host → game | `room.seats` | `seats`, `seat` | Someone joined, left, lost the connection, or a bot took a seat; this phone's seat may move between hands. |
| host → game | `room.reaction` | `seat`, `reaction` | A preset reaction. |
| game → host | `room.act` | `id`, `action` | Answered by `result`, with the rules module's error code (`must_beat`, `not_your_turn`…) when refused. |
| game → host | `room.next` | `id` | Ready for the next hand. |
| game → host | `room.react` | `reaction` | One of `wave laugh wow clap hurry gg sad heart`. |

The SDK's `session.room` (SDK 0.5.0) keeps the newest view, which may arrive before the game listens: `latest`,
`onView`, `onSeats`, `onReaction`, `act`, `next`, `react`.

**Replays** ([ADR 0017](../decisions/0017-replays-of-finished-online-hands.md), SDK 0.6.0): `init.replay` instead of
`init.room` carries `{ seats, seat, seed, options, carry, actions }`; `session.replay` hands it to the game, which
calls `setup` with the seed, options and carry, then `act` for each action, drawing `view(state, seat)`. Nothing goes
back to the hub but telemetry.

**The rules module** (TypeScript in the game's folder, `src/module.ts` built to `rules.js` by a second Vite build;
pure and deterministic: no DOM, timers, network, `Math.random` or `Date.now`):

```ts
export const rules = {
  setup(ctx: { seats: number; seed: number; options?: unknown; carry?: Carry | null }): State,
  view(state: State, seat: number | null): View,              // null: a spectator
  act(state: State, seat: number, action: Action):
    { ok: true; state: State; events: GameEvent[] } | { ok: false; error: string },
  status(state: State):
    { over: false; turn: number[]; chop: number[] }            // chop: seats that may act out of turn (bots)
    | { over: true; result: { points: number[]; … }; carry: Carry },
  timeout(state: State, seat: number): Action,                  // what the turn timer plays
  bot(state: State, seat: number, level: string, seed: number): Action | null,  // null: nothing out of turn
};
```

States, views and actions are JSON (the server stores and relays them). `carry` passes what the next hand needs from
the last one (Tiến Lên: its winner leads); the room adds each hand's `result.points` to its score sheet.

## The server

A `Rooms` module in the API with its own `rooms` schema
([ADR 0003](../decisions/0003-backend-dotnet-modular-monolith-postgres.md)), reading games through the registry's
`IRegistryGames` and profiles through `IActiveProfile`.

Every endpoint below, and the rooms hub, takes the players' scheme: the account's session, or — when the request names a
device profile — the device key alone ([Who may sit](#who-may-sit)). "The active profile" is whichever acts.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/rooms?game=` | Rooms the active profile may see: public ones it may join, and the ones it sits at |
| `GET /api/rooms/mine` | Open rooms it sits at — the host always sits — each with its six-digit `code`, to say which table and go back to it; the lobby list leaves `code` empty |
| `POST /api/rooms` | Open a room; the host takes seat 1. Options are checked against the game's `rooms.options`. `language` — `vi` by default, or `en`, the hub's — is kept with the table for its link preview ([Entry links](entry-links.md#link-previews)); anything else is `400 options_invalid` |
| `GET /api/rooms/code/{code}` | Preview by code, spaces ignored; 20 lookups a minute per profile |
| `GET /api/rooms/{id}` | A room it sits at, or may see |
| `POST /api/rooms/{id}/join` · `/leave` | Sit (an empty seat, or between hands a bot that only filled one) · leave (a bot finishes the hand) |
| `PATCH /api/rooms/{id}` · `PUT …/seats/{seat}` · `POST …/start` | The host's controls, before a hand |
| `POST /api/rooms/{id}/watch` | Watch without a seat, when the room allows spectators |
| `POST /api/rooms/{id}/invite` · `GET /api/rooms/invites` | Ask a profile to the table — of the account, or another account's as its owner allows (ADR 0033), an id merged into a profile asking that profile: `profile_not_found`, `room_account_only`, `invites_closed`, `invite_limit`, `invitee_limit`; a device profile asks nobody (`account_required`) · the active profile's invitations |
| `GET /api/rooms/stats?game=` | Its results (all time, this week) and the account's board of the week |
| `GET /api/rooms/history?game=` · `GET /api/rooms/{id}/hands/{hand}` | Its last 20 hands · one hand to replay, only for the profiles that played it — a result under an id merged into it ([merge alias](identity.md#merge-aliases)) counts as its own, here and in its statistics |
| `/api/rooms/hub` (SignalR) | `Enter`, `Exit`, `Act`, `Next`, `React`, `WatchLobby`; pushes `Room`, `View`, `Reaction`, `Closed`, `LobbyChanged` |

- **One actor per room** runs everything that happens to it one at a time: joins, actions, bots, timers. A clock
  ticks every room five times a second, each on its own task, and skips a room whose last tick (a bot thinking) has
  not finished.
- **Rules engine:** one Jint engine per room, with the room's build of the rules module fetched from the games origin
  and kept (builds are immutable, so a room keeps its version after a deploy). `Math.random` and `Date.now` throw;
  calls are limited in time (10 s), recursion and allocations. Measured with Tiến Lên's module: an action 0.16 ms,
  an easy or normal bot 2 ms, a hard bot 0.5 s (1.7 s at most) — [research](../research/online-rooms.md).
- **Durable without snapshots:** a room stores its seats, options, score sheet, the hand's seed and starting carry;
  every accepted action is appended to `rooms.actions`. When the API starts, open rooms are rebuilt by replaying the
  hand's actions from its setup (the rules module is deterministic), and phones that reconnect get the same table. A
  room whose build is gone closes.
- **Every finished hand is kept:** `rooms.hands` (build version, seed, options, carry, who sat where, result) and
  `rooms.results` (one row per seat: profile and account, place, points) next to its actions. Statistics and replays
  read them; every person's result also goes to the integrity engine, verified, in the same transaction — boards read
  it there (ADR 0029). Rooms are closed, never deleted.
- **One API instance.** Several instances would need room affinity; not planned at this scale.

## Reconnection

- The hub uses SignalR's automatic reconnect with stateful reconnect, and also checks the connection when the page
  becomes visible again: iOS closes sockets of suspended pages and does not always fire `onclose`.
- On every (re)connection the server sends the seat's full current view. Views are snapshots with a sequence number,
  so the game redraws from the snapshot and nothing has to be replayed.
- The seat is held for the grace period (30 s), then a bot plays it if the room allows; coming back takes it over
  at once. After an API restart everyone gets the grace period again.

## Security

- **Same-origin only:** the WebSocket upgrade carries the session cookie, so `/api/rooms/hub` refuses an `Origin`
  other than the hub's own host (cross-site WebSocket hijacking); unsafe requests are covered by `SameOriginGuard`.
  The hub's CSP names its own `ws://` and `wss://` host next to `'self'` for browsers older than CSP3.
- A profile is required: an account's, with its session, or a device profile with its device's key — never one for the
  other ([Identity](identity.md#device-profiles-on-the-server)). Children's access follows the age filter and the parent
  switch.
- Every action goes through the rules; the server never trusts a phone's idea of the state.
- Codes come from a CSPRNG, are unique among open rooms, and die with the room; lookups by code are rate limited per
  account. A private room is protected by not being listed and by that limit on lookups.
- Profile IDs are random (ADR 0023) and lookups by ID are limited per account, counted found or not; a child's ID is
  not found from outside its account, so an ID never tells a stranger that a child is there.
- Limits on message size and rate, on rooms per profile, and on reactions.

## Offline

| Situation | Behaviour |
| --- | --- |
| No network when opening the lobby | "Cần mạng để chơi online" and **Chơi với máy** |
| Network lost mid-hand | Banner; the seat is held, then a bot plays it; back online, the player takes over |
| API down | No rooms; offline play works, as for every game |

## Telemetry

Following [ADR 0015](../decisions/0015-device-telemetry.md): the hub counts sessions at a table
(`hub.room.session`), replays (`hub.room.replay`), reconnections of the rooms hub (`hub.room.reconnect`) and moves the
server refused (`hub.room.refused`), with the game's own telemetry as for any game; nothing about who played with
whom.

## Tests

| Where | What |
| --- | --- |
| `games/tien-len` | The rules: unit tests and a fast-check random-play bot over every house-rule combination and table size |
| Conformance | A rooms game's module loaded on its own: platform functions, bot tables to the end at every size, determinism, JSON round trips, view sizes, no browser APIs; then the game at a two-seat table refereed by its own module, and replaying a hand its bots played |
| API (`RoomsTests`) | Lobby visibility, codes, joining and refusals, the parent switch, host controls, options, a whole hand over SignalR with bots, refused actions, a restart rebuilding the hand, Jint limits and a hard bot's time, the hub's origin check; results, statistics and a replay that the rules module plays back to the same result; spectators; invitations, by ID too — the owner's setting, a child not found, the limits |
| API (`ServerDeviceProfilesTests`) | Device profiles at tables (ADR 0043): the entry levels, the children rule both ways, a whole hand over SignalR with the device key and its results marked, the terms asked again |
| Hub | Codes, seats as the game sees them, quick play, defaults, the way back after sign-in, the replay handed to the game |
| e2e (`pnpm --filter @tohe/e2e rooms`, CI) | Three phones: create; a friend with no account joins by link through the `named` screen; start, a whole hand with hints, results on both, leave, the friend's replay |


## Phases

1. **Tiến lên offline** — *done:* the game against three bots on one phone, built with the rules module and bots
   the server reuses (Tiến Lên 0.1).
2. **Rooms** — *done:* contract, SDK 0.5.0 and conformance; the `Rooms` module; lobby, quick play, create, code, link,
   QR, share; seats, bots, turn timer, reconnection, score sheet, preset reactions; the parent switch (Tiến Lên 0.2).
3. **History and family** — *done:* results, personal statistics and the household's board; the last 20 hands and
   their replays (SDK 0.6.0, [ADR 0017](../decisions/0017-replays-of-finished-online-hands.md)); spectators;
   invitations to household members; telemetry counts (Tiến Lên 0.3).
4. **Next:** spike S5 on iPhones (locked screen, network changes) before telling the family.

## Open questions

1. **Who may join a public room:** every signed-in profile on the server (proposed, as asked), with a parent switch
   per child profile for playing with other households — off by default for children (proposed)?
2. **Guests (Chơi thử):** offline against bots only (proposed), or online too?
3. **Money or chips:** none; points only (proposed), as the vision rules out anything like betting.
4. **Reactions:** preset emoji and phrases only, no typed text (proposed)?
5. **Code format:** 6 digits (proposed, easy for children on a numeric keypad) or 6 letters?
6. **Turn timer default** 20 s, and **grace period** 30 s before a bot takes a disconnected seat (proposed)?
7. **Leaderboards:** per household as today plus personal statistics (proposed); across households later, or never?
8. **Vision:** replace the non-goal "Real-time multiplayer" with "real-time action multiplayer", making turn-based
   online rooms a goal, on acceptance (proposed)?

## Decisions on the proposal's open questions

The owner accepted every proposed answer on 2026-10-16 ("theo đề xuất của ta hãy triển khai đi"):

1. Public rooms are open to every signed-in profile on the server; child profiles need a parent's switch to play
   with other households, off by default.
2. Guests play offline against bots only.
3. No money or chips: points only.
4. Preset reactions only, no typed text.
5. Room codes are 6 digits.
6. Turn timer 20 s by default; a disconnected seat is held 30 s before a bot plays it.
7. Leaderboards stay per household, with personal statistics; nothing across households for now.

Households became accounts on 2026-10-18 ([ADR 0023](../decisions/0023-accounts-own-their-profiles.md)): answers 1
and 7 now read "other accounts" and "per account".
8. The vision now lists real-time action multiplayer as the non-goal; turn-based online rooms are a goal.
