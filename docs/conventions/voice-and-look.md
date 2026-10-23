---
title: Voice and look
description: How Tò He talks and looks to families — so it reads as made by people for a Vietnamese family, not assembled from defaults. A checklist every screen and every string passes before it ships.
sidebar:
  order: 3
---

Tò He is for children and their parents in Việt Nam. It should feel like a toy someone made, not a template. Research
behind this page: `plans/launch-review/research/R-07-ai-style.md` (the tells of machine-made interfaces and copy, and
what products for children do instead). Decision: `plans/launch-review/items/D-07-visual-direction-and-voice.md`.

## Voice

**Talk like family.** Short sentences a grandparent would say out loud. Vietnamese first; English says the same thing in
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

- **Children and parents.** A screen a child uses has few words and big, labelled pictures. What is for a parent —
  papers, data, technical details, links out of Tò He — lives in Tôi, in the public pages' footer, or behind the manage
  PIN.
- **No pressure.** No streaks that punish, no countdowns to come back, no guilt ("Bạn đã bỏ lỡ…"). Praise the play,
  never the time spent.
- **Names stay names.** Proper names and established terms stay as they are inside Vietnamese text (*Tiến Lên*, *Zalo*,
  *PIN*); a game's name comes from its manifest (ADR 0048).
- **"·" belongs to data**, inside a row of facts (`Tiến Lên · 3/4 chỗ`), never inside a sentence.

## Look

- **No emoji as interface.** Icons are SVG from one set (Phosphor, MIT) and always come with a visible label; emoji stay
  only where they are content a person chose (a reaction, a name someone typed). Avatars are pictures of the house set,
  never system emoji.
- **One title per screen.** The tab bar already says where you are: a tab's screen does not repeat its name as a big
  title. One brand-coloured heading at most.
- **Brand colour is for actions.** Primary buttons and the one thing to tap next; text and titles stay ink. Colours
  only from the design tokens, in light and dark (`theming.md`).
- **Not everything is a white card.** Group with space and type first; a card only where something is one tappable
  thing (a game, a table, a profile).
- **Never cut a word.** A game's line under its name is written short (`kind` in `games/<id>/page/`), not truncated
  with "…".
- **Fill the screen it gets.** Phones, tablets and computers, upright and sideways: no game cut, no two-thirds of a
  screen left empty.
- **Touch.** Targets at least 44 px; labels under icons; no long-press menus on interface.
- **A name and its picture agree.** A suggested profile name names the animal its avatar shows.

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
10. It is clear whether the screen is for the child or the parent, and parent material sits where parents look.
11. Read it out loud in Vietnamese: would a grandparent say it like that?
