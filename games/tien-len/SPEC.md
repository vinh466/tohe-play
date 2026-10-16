# Tiến Lên (`tien-len`) — spec

> **Status: approved.** The owner asked for Tiến lên miền Nam on 2026-10-16 and accepted every proposed answer of
> [the research](../../docs/research/tien-len.md) the same day ("theo đề xuất của ta hãy triển khai đi"): the house
> rules H1–H9 with their proposed defaults, points without money, ages 6+, portrait first, offline against bots
> first and online rooms next ([ADR 0016](../../docs/decisions/0016-online-rooms-for-turn-based-games.md)). Details
> the research left open are marked *(default)*.

The southern Vietnamese shedding game for 2–4 players. Everyone gets 13 cards; in turn, beat what lies on the table
with a higher card or combination of the same kind, or pass; bombs chop 2s; the first to play all their cards wins.
It is played on one phone against bots ("Chơi với máy", 0.1) and at an online table with other people and bots
([Online](#online), 0.2); the same rules module referees both.

## Cards

- One 52-card deck. A card is a number 0–51: rank = card ÷ 4 (0 = 3, 1 = 4, … 11 = A, 12 = 2), suit = card mod 4
  (0 ♠, 1 ♣, 2 ♦, 3 ♥). So a higher number is a higher card: 3♠ (0) is the lowest, 2♥ (51) the highest.
- Every player gets 13 cards. With 2 or 3 players the other cards stay face down, unseen, for the whole hand.

## Combinations

| Kind | Vietnamese | Cards | Example |
| --- | --- | --- | --- |
| Single | Rác | 1 | 7♦ |
| Pair | Đôi | 2 of a rank | 9♠ 9♥ |
| Triple | Sám | 3 of a rank | Q♣ Q♦ Q♥ |
| Straight | Sảnh | 3–12 cards of consecutive ranks, any suits, no 2 | 5♠ 6♦ 7♣ |
| Double straight | Đôi thông | 3 or more pairs of consecutive ranks, no 2 | 4 4 5 5 6 6 |
| Four of a kind | Tứ quý | 4 of a rank | J J J J |

A combination is compared by its **top card**: its highest card, rank first, then suit.

## A hand

1. **Deal** 13 cards each, from the state's seeded PRNG.
2. **Instant win** (tới trắng, H6): a player dealt one of the enabled hands wins the hand at once (see
   [Points](#points)). Checked before the first play.
3. **The first lead:**
   - The first hand at a table, and the hand after an instant win: the holder of 3♠ leads; with H1 the lead must
     include 3♠. With 2–3 players nobody may hold 3♠: then the holder of the lowest card leads (and with H1 must
     include it).
   - Later hands: the winner (nhất) of the last hand leads anything.
4. **Turns** go counter-clockwise (on screen: the next player sits to the right).
5. **On your turn**, play a combination that beats the table, or pass (bỏ lượt). The player who leads a round must
   play.
6. **Beating:** the same kind with the same number of cards and a higher top card; or a bomb (chặt):

   | On the table | Beaten by |
   | --- | --- |
   | A single 2 | 3 đôi thông, tứ quý, 4 đôi thông |
   | A pair of 2s | Tứ quý, 4 đôi thông (and 3 đôi thông with H9) |
   | 3 đôi thông | A higher 3 đôi thông, tứ quý, 4 đôi thông |
   | Tứ quý | A higher tứ quý, 4 đôi thông |
   | 4 đôi thông | A higher 4 đôi thông |

   A triple of 2s cannot be beaten. A double straight of 5 or more pairs beats what 4 đôi thông beats, and a lower
   one of its own length.
7. **Passing** locks a player out of the round: they cannot play again until a new round starts. Exception (H2): a
   4 đôi thông may chop a 2, a pair of 2s, 3 đôi thông or tứ quý **at any time it lies on the table**, by any player
   with cards, out of turn and even after passing. Play then goes on from the chopper.
8. **Round end:** when every other player with cards has passed since the last play, the table clears and the last
   player to play leads a new round. If that player has gone out, the next player in turn order with cards leads.
9. **Going out:** a player who plays their last card takes the next place: nhất, nhì, ba, bét.
10. **Cóng** (H5): when the first player goes out, every player who has not played a single card yet is cóng: out of
    the hand at once, in the last places (in turn order).
11. **Hand end** (H7): when only one player still holds cards (they are bét); or, with "stops at the first out",
    when the first player goes out.

## House rules

Chosen per table: against bots from the main menu (**⚙️ Cài đặt → Luật nhà**; during a hand the menu shows them
read only), online when the room is created. A change applies from the next hand.

| # | Rule | Default |
| --- | --- | --- |
| H1 | The first lead must include 3♠ (or the lowest card) | On |
| H2 | 4 đôi thông may chop out of turn, even after passing | On |
| H3 | Chặt chồng: chop penalties add up along a chain and the last player chopped pays it all | On |
| H4 | Thối: 2s and bombs left in hand at the end cost points | On |
| H5 | Cóng: a player who never played when someone goes out pays double | On |
| H6 | Instant wins: sảnh rồng, tứ quý 2, 5 đôi thông, 6 đôi; optional: 3 sám liên tiếp | The first four |
| H7 | When the hand ends: at the last place / at the first out | At the last place |
| H8 | Points: places plus chops, thối and cóng / places only | Places plus chops, thối and cóng |
| H9 | 3 đôi thông beats a pair of 2s | Off |

Instant-win hands: **sảnh rồng** (one card of every rank 3 … A), **tứ quý 2**, **5 đôi thông** (five pairs of
consecutive ranks, no 2), **6 đôi** (any six pairs; a four of a kind counts as two), **3 sám liên tiếp** (triples of
three consecutive ranks, no 2). If several players have one, the first in this order wins, then the first in turn
order from the player who would lead.

## Points

Points are a table's score: never money, chips or anything that looks like a bet. Every hand sums to zero.

**Places** (both H8 choices):

| Players | Nhất | Nhì | Ba | Bét |
| --- | --- | --- | --- | --- |
| 4 | +2 | +1 | −1 | −2 |
| 3 | +3 | −1 | −2 | |
| 2 | +2 | −2 | | |

With H7 "stops at the first out", the winner takes 2 from every other player.

**Values** of what can be chopped or left over *(default, from Board Game Arena)*: a black 2 (♠ ♣) 1, a red 2
(♦ ♥) 2, 3 đôi thông 2, tứ quý 3, 4 đôi thông 4 (longer double straights 4).

With H8 "places plus chops, thối and cóng":

- **Chops:** a bomb played on a 2, a pair of 2s or a bomb is a chop worth the value of what it beat. With H3 the
  values of a chain of chops in one round add up, and when the round ends the last player chopped pays the sum to
  the last chopper; without H3, each chop is paid at once by the player chopped.
- **Thối** (H4): when the hand ends, every player still holding cards pays the value of their 2s and bombs to the
  nhất. Bombs are counted from the cards left: four of a kind first, then the longest double straights; 2s one by
  one.
- **Cóng** (H5): each cóng player pays the nhất the last place's points once more (4 players: 2), and thối as well.
- **Instant win:** the winner takes 2 from every other player; nothing else is paid for that hand.

With "places only", only places (or the instant win) count.

**Series:** the table keeps the running total of each seat over its hands (bảng điểm). A new table starts at 0.

## Bots

Bots decide from **their own seat's view** (their hand, the table, card counts, and the cards already played),
never from hidden cards. A decision waits 0.6–1.3 s *(default)* so a child can follow.

| Level | Plays |
| --- | --- |
| Dễ | A random legal play; passes now and then when it could play |
| Vừa (default) | Splits its hand into combinations (bombs and 2s kept, longest straights, triples, pairs, singles), leads its lowest combination, beats with the cheapest card that does not break a combination, chops 2s whenever it can, saves 2s while nobody is close to going out, goes out when one play empties its hand, and avoids leading singles when an opponent has one card left |
| Khó | Vừa's four best candidates checked by a short Monte Carlo look-ahead: unseen cards dealt at random to the others, played to the end by Vừa, 40 playouts a decision |

Measured with `pnpm --filter @tohe/game-tien-len simulate` (4 players, Node 24 on the owner's workstation; a hand is
about 50–70 moves):

| Table | Hands | First place | Points a hand | Time a decision |
| --- | --- | --- | --- | --- |
| Vừa against three Dễ | 300 | 80 % (Dễ 3–9 %) | +1.83 | Dễ 0.01 ms, Vừa 0.1 ms |
| Khó (40 playouts) against three Vừa | 100 | 39 % (Vừa 15–28 %) | +0.63 | about 50 ms |
| Khó (160 playouts) against three Vừa | 100 | 37 % | +0.68 | about 180 ms |
| Khó whose playouts use a quick greedy player | 60 | 23 % | 0.00 | about 34 ms |

So 40 playouts of the Vừa player are the budget: four times the playouts add nothing, and cheaper playouts lose the
edge. In the API's interpreter (Jint, [research](../../docs/research/online-rooms.md)) this module was measured at 0.16 ms
an action, 2 ms a Dễ or Vừa decision and 0.5 s a Khó decision (1.7 s at most), hidden behind the thinking delay.

## The rules module

`src/rules.ts` is the referee for both modes and stays pure: no DOM, timers, network or `Math.random`. Its shape is
the rules-module interface of [Online rooms](../../docs/architecture/rooms.md#the-contract):
`setup`, `view`, `act` (returns the new state and events, or an error code), `status`, `timeout`, `bot`. Against bots
the game calls it directly; online, the API runs the same module, built to `dist/rules.js` from `src/module.ts`.

Error codes for refused actions (shown to the player in words): `not_your_turn`, `not_your_cards`, `not_a_combo`,
`must_include` (3♠), `must_beat`, `must_lead` (passing on a lead), `passed` (locked out of the round), `over`.

`timeout` (the turn timer, online): pass; when leading, the lowest single (3♠ alone when it must be included).

## Screens

Portrait first, landscape supported *(default)*: the player's hand along the bottom, the next player to the right,
the one opposite at the top, the previous one to the left; each opponent shows an avatar, a name, a card count and
a ring while it is their turn; the table in the middle.

The kit's two stages, quick panel and HUD ([Game shell](../../docs/architecture/game-shell.md), ADR 0020). The
catalog card opens the game:

0. **Title screen** (the menu stage against bots, every time; no table running): 🃏 **Tiến Lên** on a hint of the
   felt, **🤖 Chơi với máy**, or the chip "Ván đang chơi dở." with **▶ Chơi tiếp** and **🔄 Bàn mới** (the series
   restarts at 0, asks first); **🌐 Chơi online** (signed-in players: the hub's lobby, whose ← comes back here); tools
   🔊 ⚙️ ❓; **← Về Tò He** last, under the tools. **⚙️ Cài đặt**: 🔊, **📜 Luật nhà** (H1–H9) and **🪑 Bàn chơi** (2–4 players
   and the bots' level) — from the next hand, said so while a hand is in progress — and **🎴 Bộ bài** (two or four
   colours).
1. **How to play** (before the first **Chơi** only, then from ❓): picture hints — the card order (3 lowest, 2
   highest; ♠ ♣ ♦ ♥), beat with the same kind but higher, pass if you cannot or do not want to, bombs chop 2s, first
   out wins. **▶ Bắt đầu** deals a practice hand: the suggestion is shown on every turn with a sentence saying why.
2. **Table** (the play stage, created on play from the save): the kit's HUD — ☰, the series score, the hand's
   number, (😀 at a table) and a sort toggle (by rank / by combinations); buttons **Bỏ lượt**, **Gợi ý**, **Đánh**.
   Tapping a card lifts it (selected); sliding a finger along the hand selects a run. Tapping one card when nothing is
   selected suggests the smallest play with it that beats the table. **Đánh** is enabled only for a selection that
   may be played; otherwise the reason is shown ("Phải lớn hơn đôi 7").
3. **Hand results:** places with avatars, the points of the hand line by line (places, chops, thối, cóng), the series
   score, **Ván tiếp** and **🏠 Menu chính** (the shell's end card: Back goes to the title screen).
4. **Quick panel** (☰, phone Back, Esc, or the hub hiding the game): **▶ Tiếp tục**; 🔊 Âm thanh as a switch;
   **🎴 Bộ bài · (the deck) ›**, which opens the two decks over the panel (a tap redraws the cards behind it); 🔄 Bàn mới (asks) · ❓ Cách chơi · 🏠 Menu chính
   (the hand waits: **Chơi tiếp**). Bots stop while it is open. At an online table (no title screen): "Bàn vẫn tiếp
   tục khi bạn mở menu.", 🔊, 🎴, **📜 Luật của bàn** (read only), ❓, and **Rời bàn** / **Thôi xem**; in a replay,
   **Về sảnh**.

## Feel (juice in tiers)

| Event | Feel |
| --- | --- |
| Deal | Cards fly to every seat in turn; the player's land full size on the spots of the sorted hand, left to right, and turn over there one after another |
| Select | The card lifts with a tick |
| A play | Cards slide to the table with a soft thud; the previous play slides aside and dims |
| A refused play | The selection wobbles, soft error sound and vibration, the reason in words |
| Your turn | A ring on your side, a short note and a tap vibration |
| Pass | "Bỏ" bubble at the player |
| Round won | The table sweeps to the winner |
| A 2 played | A brighter thud |
| Chop | Medium shake, red burst, "Chặt!" |
| Chop on a chop | Large shake, bigger burst, "Chặt chồng!" |
| Going out | "Nhất!", "Về nhì", … at the player; nhất gets confetti if it is the player |
| Cóng, thối | A banner in the results, a low sound |
| Instant win | Confetti, fanfare, the winning hand shown face up |

## Online

At a table ([Online rooms](../../docs/architecture/rooms.md), ADR 0016) the hub opens the game with `init.room`, and
the server referees with this module: the game sends actions (`session.room.act`) and draws the views it receives.

- **Seats** come from the room: people with their name and avatar (🤖 after the name while a bot plays for them, "…"
  while their phone is gone), and bots as "Máy · Vừa". The HUD shows "Bàn online" and this seat's table score from
  the room's score sheet.
- **Views** are drawn one at a time in the order they came, each with its events animated as against bots; a view
  with fewer moves than the last, or a fresh deal, is a new hand and is dealt.
- **A refused action** (another phone acted first, the timer ran out) shakes the selection and says why, from the
  rules' error code.
- **The turn timer** counts down on the status line.
- **Results** come from the hand's view; **Ván tiếp** tells the room this phone is ready and shows "Đang chờ mọi
  người…" until the next hand is dealt (when everyone is ready, or after 30 s).
- **😀** sends one of the eight preset reactions; others' appear as bubbles at their seats.
- **☰** at a table (phone Back, Esc): "Bàn vẫn tiếp tục khi bạn mở menu." — **▶ Tiếp tục**, **🔊 Âm thanh**, **❓ Cách
  chơi**, **⚙️ Cài đặt** (Luật của bàn, the host's house rules, read only; Bộ bài), **Rời bàn** (the hub asks whether to
  give the seat up). There is no main menu at a table and nothing pauses: the table goes on, and so do its
  animations.
- The practice hints of the first hand also show online.
- **Watching** (seat -1, when the room allows spectators): the HUD says "Đang xem" without a score or the sort
  button, the table shows card counts and plays but no hand, and there are no buttons and no 😀. The results show
  the room's score sheet, without **Ván tiếp**.

## Replay

Opened with `init.replay` ([ADR 0017](../../docs/decisions/0017-replays-of-finished-online-hands.md)), the game deals
the hand again from its seed, options and carry with this module and plays the recorded actions back from the
asking seat, animated as they were played. The HUD says "Xem lại", without a score; the three buttons become **◀ Lùi** (one action
back: the hand is rebuilt from its deal), **Tới ▶** (one action forward) and **▶ Phát / ⏸ Dừng** (one action every
0.65 s); the status line says "Xem lại ván · bước 3/23". At the end the hand's results show (its points only: a
replay has no score sheet) with **Xem lại từ đầu**.
Nothing is saved and nothing goes to the room.

## What is saved

After every action: the hand in progress (state), the series score, the table's settings (house rules, players,
bot level, deck), whether the intro was seen, and simple statistics (hands, places). JSON, far below 64 KB. Online,
the table is the server's: only the preferences (deck, sort) and the statistics change.

## Themes

Light and dark, following the hub. The felt and the HUD follow the theme; card faces stay light paper in both
(slightly dimmer in dark) because they are objects, with red/black or four-colour suits that meet contrast.

## Invariants (checked by the random-play bot)

1. The 52 cards are always all there and distinct: hands, cards played this hand, and undealt cards.
2. Every accepted play is a valid combination from the player's own hand that may be played then (it beats the
   table, includes 3♠ when required, and comes from the player whose turn it is, or is an H2 chop).
3. A player who passed plays nothing more in that round, except an H2 chop.
4. The turn always belongs to a player who holds cards and has not passed, while the hand goes on.
5. Every hand ends, places are a permutation of the players, and the points of a hand sum to zero, in every house
   rule combination.
6. The same seed and the same actions give the same state (deterministic replays and saves).
7. A seat's view never contains another seat's cards, and bots only ever return legal actions.
8. A saved state restores to the same game.

## Changelog

- **0.6.1** — 🎴 Bộ bài in the panel opens the decks as a list (the chips cut the long names); the title screen's
  way back to Tò He is its last button; the play button's ring hugs it.
- **0.6.0** — two stages (ADR 0020): the title screen runs no table; the table is built on play (its code
  fetched in the background) and freed on 🏠; the quick panel switches sound and the deck in place, and has no way
  out to Tò He (at a table and in a replay it keeps the seat's).
- **0.5.0** — game shell 2 (ADR 0019): a title screen with tools (🔊 ⚙️ ❓), the how-to before the first hand,
  🔄 Bàn mới in the ☰ menu, the menu opens when the hub hides the game against bots, the hand's results are the
  shell's end card (Back → title screen), and the kit's HUD.
- **0.4.0** — the game shell (ADR 0018): the main menu on open (Chơi với máy / Chơi tiếp, Bàn mới, Chơi online,
  Cài đặt, Cách chơi, Về Tò He), one ☰ menu with the way out (Rời bàn / Thôi xem / Về sảnh at a table, watching and
  in a replay), house rules and players fixed during a hand, phone Back.
- **0.3.1** — the deal lands the player's cards where they will lie and turns them over there, instead of
  spreading backs, removing them and showing the hand.
- **0.3.0** — replays of finished online hands (`init.replay`, SDK 0.6.0) and the spectator view.
- **0.2.0** — online tables (ADR 0016): `rooms` capability and options in game.json, `dist/rules.js` built from
  `src/module.ts`, the online mode above.
- **0.1.0** — against bots on one phone.
