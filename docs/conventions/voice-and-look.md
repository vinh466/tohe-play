---
title: Voice and look
description: How Tò He talks and looks — a game shelf for players aged 16 and over first, a warm family mode second. A checklist every screen and every string passes before it ships.
sidebar:
  order: 3
---

Decisions: [ADR 0057](../decisions/0057-a-game-shelf-for-16-plus.md) (the shelf, 16+ first, family as a layer),
[ADR 0049](../decisions/0049-a-crafted-toy-voice-and-look.md) (a toy someone made, not a template). Research:
`plans/surface-v2/research/R-01-current-surface-review.md` (the "AI" tells today),
`plans/launch-review/research/R-07-ai-style.md` (the tells and the prior art).

## Who it talks to

**A player, 16 or older, who has used web apps before.** They know Poki, CrazyGames, Discord, TikTok. They want to see
games, start one in seconds, understand what it is, and not be talked to like a child. They are the default on every
screen.

**A parent**, less often, who manages a child's profile, a PIN, time or data. They are a real user but a minority; they
find their part in `/family` and in `Tôi → Gia đình`, not at the front.

**A child** plays, but is not the person the surface is designed around. A child's profile may get simpler screens
(fewer words, bigger pictures), but that is a mode, not the default.

## Two registers

The same person speaks; the register changes with who is in front of the screen.

| | **Default — 16+** | **Family — `/family`, profile management** |
| --- | --- | --- |
| Sounds like | a friend at the next table: short, dry, a little funny | a patient adult explaining to another adult |
| Says | "Sạp mở rồi." · "Chơi một ván rồi tính." · "Rủ bạn qua một link." | "Bé chơi an toàn: không quảng cáo, không chat với người lạ, bố mẹ giữ PIN." |
| Avoids | "cả nhà", "bé", "bố mẹ", "Chào mừng đến", "Sẵn sàng chơi?" | slang, irony, "nghiện", "cày" |
| Pronouns | "bạn" only when needed; often no subject | "bố mẹ", "bé", "con" |
| Length | one idea, one line | one idea, one short paragraph |

Both registers follow the rules below. A screen may switch register only at a clear boundary: `/family`, the parent
gate, a child's profile — never mid-sentence on the shelf.

## Voice

**Talk like a person.** Short sentences a friend would say out loud. Vietnamese first; English says the same thing in
plain English, not a translation of the Vietnamese words.

| Do | Don't |
| --- | --- |
| Active voice: "Thả khối xuống cột." | Passive "được/bị" carried over from English: "Tiến độ được lưu…" |
| Drop "bạn" when the subject is clear: "Gõ mã hoặc dán link." | "bạn" in every sentence |
| Everyday words: "mất mạng", "chưa chạy được", "hiện" | System words: "ngoại tuyến", "phản hồi", "hiển thị", "thành công" |
| One idea per sentence; a full stop | Triads joined by "·" in a sentence ("Không A · Không B · Không C") |
| At most one long dash (—) per screen | A dash in every line; "not just X — it's Y" |
| Sentence case: only the first word and names capitalised | Title Case in Vietnamese or English headings |
| Say what happens and what to do next | Explain how it works inside ("máy chủ", "hợp đồng", SHA, "game mẫu") |
| Rules only where they help: a code's length in the error, not in the label | The same rule in the label and the hint |

- **No pressure.** No streaks that punish, no countdowns to come back, no guilt ("Bạn đã bỏ lỡ…"). Praise the play,
  never the time spent.
- **Names stay names.** Proper names and established terms stay as they are inside Vietnamese text (*Tiến Lên*, *Zalo*,
  *PIN*); a game's name comes from its manifest (ADR 0048).
- **"·" belongs to data**, inside a row of facts (`Tiến Lên · 3/4 chỗ`), never inside a sentence.
- **A game's hook is written, not cut.** One line, ≤ 60 characters, no "…" in the middle of a word.

## Look

### Colour

- **Roles, not hues.** `page` is rice paper, `surface` is the sheet a card sits on, `ink` is the text, `brand` is gấc red
  for the one action to take, `accent` is turmeric for new or attention, `leaf` is together/online. Values live in
  `packages/design-tokens/tokens.css`; the contrast tests are the judge.
- **Brand colour is for actions.** Primary buttons and the one thing to tap next; text and titles stay ink. A screen has
  at most one brand-coloured heading.
- **No gradients, no glow, no wide soft shadows.** Depth comes from a 1.5 px ink border and a hard offset shadow of
  2–3 px, like a printed sticker.
- **Light and dark are designed together.** Dark is warm charcoal, never pure black; a cover keeps its colours and gains
  a thin border.

### Type

- **Be Vietnam Pro** for the interface — drawn for Vietnamese, self-hosted. Headings 700–800, tracking slightly tight,
  sentence case. Body 16–18 px; numbers tabular for scores and times.
- **A hand-drawn wordmark** for "Tò He", used once in the header and once in the footer. No novelty font without a
  Vietnamese proof.
- **One title per screen.** The tab bar or the rail already says where you are: a tab's screen does not repeat its name
  as a big title. One brand-coloured heading at most.

### Shape and layout

- **A card only where something is one tappable thing**: a game, a table, a profile. Groups of settings are a heading
  and rows, not a card each.
- **Game cards are cover-first**: a 16:9 picture, a name, a hook, a tag row, a visible **Chơi**. Not a square icon.
- **Fill the screen it gets.** Phone: two columns of games, a bottom bar. Tablet: three or four, a rail. Computer: four
  to six, max 1440 px, never a narrow column with two-thirds empty.
- **Touch.** Targets at least 44 px; labels under icons; no long-press menus on interface.

### Pictures and motion

- **Pictures are the product.** A cover per game, three screenshots or a short muted clip on its page. Icons stay for
  the PWA and a game's own header. No stock illustration, no emoji as interface.
- **Motion is feedback**, not decoration: a card lifts 2 px, a cover zooms 1.02, a button presses down. No entrance
  animation on every tile; respect `prefers-reduced-motion`.

## Checklist (every screen, every pull request that changes one)

1. No emoji acting as an icon or a button; every icon has a label.
2. The screen's title does not repeat the selected tab; at most one brand-coloured heading.
3. Not a stack of identical centred white cards; no "heading + paragraph + link →" repeated.
4. No text cut with "…" in the middle of a word.
5. A suggested name and its avatar match.
6. Works in light and dark, at 360 px, on a tablet, on a computer, and on a phone held sideways.
7. Targets ≥ 44 px with visible labels.
8. Copy passes the Voice table: no "·" triads in sentences, at most one long dash, active voice, few "bạn", everyday
   words, sentence case.
9. Nothing internal reaches a player (SHA, "game mẫu", "hợp đồng", "AI").
10. It is clear whether the screen is for the default 16+ register or the family register; family material sits in
    `/family`, `Tôi → Gia đình`, or behind the manage PIN.
11. The first screen shows a game, not only a logo and a claim; the main action is visible without scrolling.
12. Read it out loud in Vietnamese: would a friend say it like that? In the family register, would a parent say it to
    another parent?
