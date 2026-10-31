---
title: "0057: Make the surface a game shelf for 16+, with family mode as a layer"
description: The front page and the app's first screen become a cover-first game shelf for players aged 16 and over; the door stays but play comes first, a sign-up is suggested after a game has been played, and family management moves to Tôi and /family.
sidebar:
  order: 57
---

- **Status:** Accepted
- **Date:** 2026-10-31
- **Amends:** [ADR 0046](0046-player-surfaces-two-zones-one-frame.md) — the Discover zone's home is a shelf, not an
  introduction; the Play zone's first tab is **Sạp**. [ADR 0047](0047-two-languages-and-an-introduction-surface-that-grows.md)
  — the home page is the shelf; the game pages are store pages. [ADR 0049](0049-a-crafted-toy-voice-and-look.md) — the
  default register is 16+, family is a second register; the look is paper, ink, gấc, turmeric and leaf.
  [ADR 0055](0055-front-page-explains-greets-and-the-app-asks-once.md) — `/` no longer explains Tò He in sections; the
  door stays but **Chơi ngay** comes first and a sign-up is suggested after value.
- **Decided by:** the owner, 2026-10-31, answering the six questions of `plans/surface-v2`:
  "1. dong y nha" · "2. nhu prototype trông ổn nha" · "3. giữ nhưng choi ngay lên trước, sẽ cân bằng viêc người chơi cũ
  vào lại hay lẫn người mới muốn thử ngay, ngoài ra cũng cần quan tâm luồng gợi ý người mới đăng ký đang nhập nhé" ·
  "4. đòng ý" · "5. screenshot + khung tạm tạm thời đi" · "6. Sạp đi".

## Context

The owner reviewed production on 2026-10-31 and found the surface "khá là AI" and not designed from the player's side:
new and returning players should have a clean experience across devices and understand what the app does. The people it
is for are mostly **16 and over**, already used to web apps; children are a small part, reached through a parent who
manages them. Research and screenshots are in `plans/surface-v2/research/` (R-01, R-02, R-03).

Today the surface is three products joined at the root:

- `/` is an introduction in six sections, written for a family; the first screen shows a logo, a line and two buttons,
  no game. It is a landing page, not a place to play.
- `/play` is an app launcher: five large square icons, no covers, no categories, no search, and the only visible action
  on a tile is *Rủ bạn*. On a 1440 px screen half the page is empty.
- `/games/<id>/` is an article: a 96 px icon, a facts table, how-to and questions; no gameplay picture.

The "AI" feeling is not mainly the orange palette. It is the absence of specific content: no game art, no screenshots,
no numbers, no editorial voice. The page has every template part — centred hero with a logo, a three-item feature grid,
numbered steps, an FAQ on the home page, a closing call, a link-farm footer — and nothing that only Tò He could show.

Peers (R-02) put covers first, keep discovery dense but rhythmic, put search and a few tags in reach, and open a game
from its own page. A shelf with five games does not need Poki's density; it needs a featured game, shelves and an
editorial list so the eye has somewhere to go.

## Decision

### Audience and voice

- **16+ is the default.** The surface talks to a player who has used web apps before: short sentences, a little dry,
  no "cả nhà", "bé" or "bố mẹ" at the front.
- **Family is a second register**, used only in `/family` and the screens that manage profiles: warm, patient, plain.
- **The name and the craft stay.** Tò He keeps its name and its hand-made toy character. **Sạp** (a small stall) is the
  metaphor for the surface and the name of the app's first tab; it is not a new brand.

### The shelf

- **`/` is the shelf**: a hero with one game (cover 16:9, name, one-line hook, *Chơi ngay*, *Rủ bạn*), an "Đang mở" list,
  a one-line trust strip, *Chơi tiếp* on a device that has played, *Mới tuần này*, a *Rủ bạn* band with *Tạo bàn* and
  *Nhập mã*, and *Tất cả trò chơi* with a few tags.
- **`/play` is the app's shelf**: who is playing and *Nhập mã*; *Chơi tiếp*; the tables the player sits at; invitations;
  *Gần đây*; every game as a cover-first card with a visible *Chơi*. Search and four tags: Giải đố, Bài, Phản xạ,
  Chơi cùng.
- **A game's tile is a cover, a name, a hook and a Play action**, not a square icon. On a phone two columns; on a
  computer four to six, never stretched to fill a row. Age is not on the tile.
- **`/games/<id>/` is a store page**: cover, hook, Play and *Rủ bạn*, facts as chips, three screenshots or a short muted
  clip, how to play in three lines, other games; age sits under "Phù hợp", not beside the name. `/play/<id>` remains
  where the game is played, full screen.
- **The old introduction moves**: what Tò He is → `/about`; parents → `/family`; install, questions and contact →
  `/faq/` and `/guides/`. The home page keeps a one-line trust strip and the footer, not six sections.

### The door and the sign-up

- **The door stays** at `/account/sign-in`; it is not a wall and it is not removed.
- **Play comes first**: *Chơi ngay* is the primary button and makes or uses the device profile; *Đăng nhập* is the
  secondary button; *Tạo tài khoản* is a link. A device that has played sees *Chào lại, <name>* and *Chơi tiếp <game>*.
- **The auth screens carry no tab bar.**
- **A sign-up is suggested after value, never before it**: after the first finished game, a small card *Giữ điểm này?*
  with *Tạo tài khoản* and *Để sau*; on the second visit or second game, a quiet banner *Điểm đang ở máy này. Đăng nhập
  để mang theo.* It never appears during a game; *Để sau* hides it for seven days; signing up carries the device
  profile and its progress.
- Links to a game, a table or a share still play at once.

### Family

- **`/family`** is a public page for parents: safety, profiles, PIN, data, time, questions; the family register lives
  here.
- **`Tôi → Gia đình`** manages profiles, PIN and limits behind the parent gate. The main header and the shelf never lead
  with it.

### Look and content

- **Colour**: paper, ink, gấc red for actions, turmeric for new/attention, leaf for together/online; warm charcoal in
  dark mode. Values live in `packages/design-tokens/tokens.css` and pass the contrast tests; no gradients or glows.
- **Shape**: cards with a 10–14 px radius and a 1.5 px ink border; buttons with a hard offset shadow; sticker labels;
  cards only where something is one tappable thing.
- **Type**: Be Vietnam Pro for the interface; a hand-drawn wordmark for the name; headings in sentence case.
- **Pictures**: a 16:9 cover per game, three screenshots or a short clip on its page; icons stay for the PWA and a
  game's own header. **For now covers are screenshots in a shared temporary frame**; drawn covers come later without a
  layout change.
- **Content per game**: `hook` (≤ 60 characters), `tags` (2–3), `cover` 16:9, `shots` 3; the age stays in the facts.
- **Motion** is feedback only: a card lifts, a cover zooms a little, a button presses; no entrance animation on every
  tile; `prefers-reduced-motion` respected.

### Not done

- No new host, domain or app; `/` stays `/`, the app stays `/play` ([ADR 0042](0042-hosts-by-trust-paths-by-component.md)).
- No change to games, their rules or the Game Contract unless a cover field is needed; that is its own ADR if so.
- No chat, friends, payments, ads or subscriptions.
- No removal of the family mode, PIN or the safety promise.

## Consequences

- **Spec**: [Voice and look](../conventions/voice-and-look.md) (two registers, new look), [Surfaces](../architecture/surfaces.md)
  (the shelf, the frame, the door, the family page), [Theming](../architecture/theming.md) (token roles and shape),
  [Vision](../vision.md) (16+ first, family mode), [Identity](../architecture/identity.md) (where family management
  lives). This ADR is the root; the docs carry the detail.
- **Routes**: `/family` (public) and `/account/family` (hub) enter `packages/routes` first ([ADR 0042](0042-hosts-by-trust-paths-by-component.md)).
- **Code**: `apps/web` home and game page; `apps/hub` catalog, door, account, together; `packages/design-tokens` palette
  and contrast tests; a `GameCard`/`Cover` primitive; the API catalog gains a cover address if the convention needs it.
- **SEO**: `/` loses the long introduction; `/about`, `/family`, `/games/` and the game pages carry the words, with the
  same JSON-LD. A crawler sees the shelf like a newcomer.
- **Tests**: routes, tab names, door order, sign-up nudge, covers at 360/768/1440, light/dark, axe; e2e journey updated.
- **Costs accepted**: a newcomer still passes one door screen (one tap); a returning player sees the greeting; five games
  may look sparse until more arrive — the shelf's editorial rhythm is the answer, not invented numbers.

## Alternatives considered

- **Keep the introduction and add a catalog below it.** It keeps the story but repeats the list and delays play; the
  owner asked for the prototype's shelf.
- **A pure arcade portal (Poki/CrazyGames density).** Needs many games; with five it looks empty and generic, and loses
  the hand-made character.
- **A folk-craft surface (Đông Hồ, paper, woodblock) as the whole identity.** Beautiful, but easy to read as children's
  or Tết; it also fights dark mode. The craft stays in details, not the whole frame.
- **Remove the door entirely.** Fastest for a new player, but loses the place where an account is explained and a
  returning player signs in; the owner chose to keep it and put play first.
- **A separate family app or host.** More isolation than the minority needs; `/family` plus the parent gate is enough.
