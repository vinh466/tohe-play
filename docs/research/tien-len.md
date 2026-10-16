---
title: Tiến lên miền Nam research
description: The rules every table agrees on, the house rules that differ and become room options, the features of a complete game, and the technology for its table.
sidebar:
  order: 3
---

Question (owner, 2026-10-16): *research and list the features a complete Tiến lên miền Nam would have, for review.*
The owner accepted the proposed answers the same day
([decisions](#decisions-on-the-proposals-open-questions)); the game's rules are now specified in
[`games/tien-len/SPEC.md`](../../games/tien-len/SPEC.md). Online play is a platform feature:
[Online rooms](../architecture/rooms.md).

## Rules every table agrees on

| Topic | Rule |
| --- | --- |
| Deck and players | 52 cards, 2–4 players, 13 cards each; with 2 or 3 players the rest stay face down |
| Card order | 3 < 4 < … < K < A < 2; suits ♠ < ♣ < ♦ < ♥ (so 3♠ is the lowest card, 2♥ the highest) |
| Combinations | Single (rác), pair (đôi), triple (sám), straight (sảnh: 3+ consecutive ranks, no 2), double straight (đôi thông: 3+ consecutive pairs, no 2), four of a kind (tứ quý) |
| Following | Same kind and size, with a higher top card (rank, then suit) |
| Passing | A player who passes sits out until someone wins the round (vòng) and leads again |
| First hand | The holder of 3♠ leads |
| Later hands | The winner of the last hand leads |
| Chopping (chặt) | 3 đôi thông beats a single 2; tứ quý beats a single 2, a pair of 2s and 3 đôi thông; 4 đôi thông beats a single 2, a pair of 2s, 3 đôi thông and tứ quý; each also beats a lower one of its own kind |
| End | Players go out in order: nhất, nhì, ba, bét |

## House rules

Sources disagree on these, and so do families. Each becomes a **game option** of the room, with a default the
owner confirms. *Proposed* defaults are marked; none is decided.

| # | House rule | Choices | Proposed default |
| --- | --- | --- | --- |
| H1 | The first lead must include 3♠ | Yes / no | Yes |
| H2 | 4 đôi thông may chop out of turn, even after passing | Yes / no | Yes |
| H3 | Chặt chồng: a chop can be chopped again, and penalties add up onto the last player chopped | On / off | On |
| H4 | Thối: 2s and bombs left in hand at the end cost points | On / off | On |
| H5 | Cóng: a player who has not played a single card when someone goes out pays double | On / off | On |
| H6 | Tới trắng (instant win on the deal) | Any of: sảnh rồng (3→A), tứ quý 2, 5 đôi thông, 6 đôi, 3 sám liên tiếp; tứ quý 3 or 3 đôi thông with 3♠ in the first hand | Sảnh rồng, tứ quý 2, 5 đôi thông, 6 đôi |
| H7 | When the hand ends | Played to the last place / stops when the first player goes out | Played to the last place |
| H8 | Points | Places only (+2 / +1 / −1 / −2, as Board Game Arena) / places plus chops, thối and cóng as points | Places plus chops, thối and cóng |
| H9 | Whether 3 đôi thông can beat a pair of 2s | No / yes | No |

Penalty values (a black 2 is worth less than a red 2; 3 đôi thông < tứ quý < 4 đôi thông) go in the SPEC once H3–H5
and H8 are chosen. Points are a table's score, never money (see [open questions](#open-questions)).

## Features of a complete game

Each line says where it lives: **G** the game (its rules module and view), **P** the platform (rooms, reused by later
games). Phases follow [Online rooms](../architecture/rooms.md#phases): **1** offline, **2** online, **3** polish.

### Playing a hand

| Feature | Where | Phase |
| --- | --- | --- |
| Deal animation; the hand sorted by rank, or by combinations (toggle) | G | 1 |
| Tap cards to select, slide a finger across cards to select a run; big **Đánh** and **Bỏ lượt** buttons | G | 1 |
| Smart select: tap one card and the smallest combination with it that beats the table is suggested | G | 1 |
| **Gợi ý**: cycles through the legal plays; cards that cannot be played are dimmed | G | 1 |
| A refused play says why, in words a child understands ("Phải lớn hơn đôi 7") | G | 1 |
| The table shows the last play and who made it; every opponent's card count and pass mark | G | 1 |
| Tiered feel: a play, a winning play, a chop, a stacked chop, an instant win, thối — each bigger than the last (kit `juice`, `sfx`, `haptics`) | G | 1 |
| Results: places, chops, penalties, points; the series score | G + P | 1 |
| The room's house rules on one screen, with card pictures | G | 1 |
| A first-time tutorial: a guided hand with hints (for children) | G | 1 |
| Light and dark themes; a four-colour deck option for small screens | G | 1 |
| Turn timer ring and a sound and vibration when it is your turn | G + P | 2 |

### Bots

| Feature | Where | Phase |
| --- | --- | --- |
| Dễ: a random legal play, rarely passes | G | 1 |
| Vừa: heuristics — sheds low cards and straights first, keeps bombs and 2s for the right moment | G | 1 |
| Khó: heuristics plus a short Monte Carlo look-ahead within a fixed budget ([evidence](online-rooms.md#evidence-a-spike-on-2026-10-16)) | G | 1–2 |
| A human-like thinking delay (0.6–1.5 s) | G + P | 1 |
| Fill empty seats; play for a disconnected player until they return | P | 2 |
| Bots never see hidden cards: they decide from their own seat's view | G | 1 |

### Rooms (the platform's reference flow)

| Feature | Where | Phase |
| --- | --- | --- |
| Lobby: public rooms live, **Chơi nhanh**, **Tạo phòng**, **Nhập mã**, **Chơi với máy** | P | 2 |
| Private rooms; 6-digit code; `/r/<code>` link; QR; Web Share (Zalo, Messenger) | P | 2 |
| Waiting room: seats, ready marks, add or remove a bot per seat | P | 2 |
| Host: change options, remove a player, pass the host role, lock the room, start | P | 2 |
| Reconnect and resume after a locked screen, a network change or a deploy | P | 2 |
| Next hand, rematch, leaving between hands, a newcomer taking a free seat | P | 2 |
| Preset reactions (emoji and short phrases), no typed chat | P | 3 |
| Spectators | P | 3 |
| Invite a household member from the room, shown in their hub | P | 3 |

### Progress

| Feature | Where | Phase |
| --- | --- | --- |
| The series score of a room (bảng điểm) | P | 2 |
| Hand history and replay of a finished hand, every hand revealed, from its seed and actions | P + G | 3 |
| Personal statistics: hands, places, chops, instant wins | P | 3 |
| Household leaderboard (wins or points per week) | P | 3 |
| Offline: an unfinished hand against bots resumes where it stopped (save after every move) | G | 1 |

### Family and operations

| Feature | Where | Phase |
| --- | --- | --- |
| Parent switch: a child may play with other households | P | 2 |
| Age filter (`minAge`) as for every game | P | 1 |
| Telemetry: reconnects, refused actions, round-trip time | P | 2 |
| Bot-only tables on the dev stack playing thousands of hands to test the server | P | 2 |
| An operator view of open rooms | P | 3 |

### Later, on the same foundation

Tiến lên miền Bắc (suit and colour rules), counting-cards scoring (đếm lá), Sâm lốc, Phỏm, and board games such as
Cờ caro and Cờ tướng online: each is a new rules module and view; the rooms stay the same.

## Technology for the table

Question (owner, 2026-10-16): *is the UI technology good enough, or should a better one be researched for this game?*

**Answer: keep Phaser 4 with the game kit for the table** ([ADR 0012](../decisions/0012-phaser-and-the-game-kit.md));
the lobby and waiting room are hub pages in React, like the rest of the hub. What makes a card game feel polished
is the cards, the motion and the feedback, not a different engine:

| Need | How |
| --- | --- |
| Crisp cards on every phone | Each card face is drawn once into a texture at device pixels (the kit's `drawTexture`), with vector suit shapes instead of font glyphs (iOS draws ♥ as an emoji in some fonts). 52 cards cost 52 quads a frame. |
| Dealing, playing, chopping | Phaser tweens and timelines; the kit's tiered `juice`, `sfx` and `haptics` |
| Light and dark, four-colour deck | Textures keyed by theme and deck, redrawn on change, as the block games do |
| Menus and results | The kit's DOM overlay |
| A WebGL failure | The kit's Canvas fallback, already proven on the A55 |

Considered and not needed now:

- **DOM and CSS animations:** good for UI-like games, but the kit's sounds, juice, telemetry and fallback are built
  around a Phaser scene, and a second way of building games costs more than it gives.
- **Rive or Lottie** for animated effects: a runtime in every build and files made in a designer's tool, which
  agents cannot write or review.
- **A ready-made SVG deck:** a CC0 four-colour deck exists (about 200 KB), and classic court figures would look more
  traditional. Drawn cards are smaller, follow the themes and need no licence check; a classic deck can be an option
  later.

## Layout on a phone

iOS Safari cannot lock the orientation of a web page, and spike S3 (orientation inside the iframe) is still open.
Proposed: **portrait first** — the player's 13 cards fanned in one or two rows at the bottom, the three opponents
top, left and right with avatar, card count and timer ring, the table in the middle — with landscape supported.
Card apps are often landscape; this is an open question.

## Open questions

1. **House rules:** the defaults H1–H9 above?
2. **Points:** places plus chops, thối and cóng (proposed), or places only? Never money or chips (proposed)?
3. **Age:** `minAge` 6 (proposed)?
4. **Orientation:** portrait first (proposed) or landscape?
5. **Phase 1 first:** ship Tiến lên offline against bots before the rooms (proposed), so the family settles the house
   rules while the platform work is reviewed?
6. **Id and name:** `tien-len`, "Tiến Lên" (proposed)?

## Sources

- [Board Game Arena: Tiến lên rules](https://en.doc.boardgamearena.com/Gamehelptienlen): bombs, instant wins,
  points, hoarding penalties.
- [Wikipedia: Tiến lên](https://en.wikipedia.org/wiki/Ti%E1%BA%BFn_l%C3%AAn): card order, combinations, bombs.
- [Thư viện Pháp luật: đánh bài tiến lên là gì](https://thuvienphapluat.vn/phap-luat/danh-bai-tien-len-la-gi-tu-quy-la-gi-ba-doi-thong-la-gi-cach-danh-bai-tien-len-danh-bai-tien-len-te-476653-199388.html):
  chopping rules as commonly described in Vietnam.
- [Kelly and Churchill: MCTS for Cribbage](https://www.cs.mun.ca/~dchurchill/publications/pdf/necec17cribbage.pdf):
  determinised Monte Carlo for imperfect-information card games, the approach behind the "Khó" bot.
- [Classic 4-colour poker deck (SVG, CC0)](https://opengameart.org/content/classic-4-color-poker-deck-svg) on
  OpenGameArt: the ready-made deck considered for the table.

## Decisions on the proposal's open questions

The owner accepted every proposed answer on 2026-10-16 ("theo đề xuất của ta hãy triển khai đi"):

1. House rules H1–H9 default as proposed.
2. Points: places plus chops, thối and cóng; never money or chips.
3. `minAge` 6.
4. Portrait first, landscape supported.
5. Tiến lên offline against bots ships first, then the rooms.
6. Id `tien-len`, name "Tiến Lên".
