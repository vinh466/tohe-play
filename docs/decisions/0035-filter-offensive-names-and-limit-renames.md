---
title: "0035: Refuse names with an offensive word, matched as people write it; an owner renames a profile five times a day"
description: Profile names keep being free, but a short list of Vietnamese and English words, which the owner reviews, is refused as whole words — Vietnamese with their marks, the rest without marks and with look-alike digits read as letters — and a profile's owner renames it at most five times in 24 hours.
sidebar:
  order: 35
---

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [ADR 0023](0023-accounts-own-their-profiles.md) — free names get one more rail

## Context

Names are free and not unique (ADR 0023, D-17) and shown to strangers: in rooms, on public boards, on the card found by
an ID. The rails so far keep them visible, bounded and not the platform's own; nothing stopped a rude word, and a
profile could be renamed to one and back as often as its owner liked. Moderators rename and hide profiles from the
console (ADR 0027, 0031), but only after someone saw it.

The owner decided E-07 on 2026-10-18 ("ok như bạn đề xuất, làm đi"): a filter (Q4) whose list the owner reviews, and 5
renames a day (Q5). A report button stays for after launch (Q6).

Two facts shape the matching. Vietnamese swear words without their marks are mostly everyday words — "lớn" (big),
"các" (the), "đi" (go), "buổi" (a session), "Diễm" (a name) — so stripping marks, the usual first step of such filters,
would refuse half the language. And the API has no ICU (InvariantGlobalization): it cannot decompose text, yet a name
may arrive with its marks composed or typed apart.

## Decision

- **`NameFilter`**, one more rule of `ProfileNames.TryNormalize` — so it holds wherever a name is set: signing up (by
  email or a provider), adding or renaming a profile, a moderator's rename. Refused names answer `name_inappropriate`
  on the name field.
- **Two lists**, in code, reviewed by the owner in the PR:
  - **with marks** — Vietnamese words, compared letter by letter with their marks, whatever the case and whichever way
    the marks were typed: each vowel is read as its base letter and its set of marks (a table of the 72 marked vowels,
    since there is no ICU), so composed, decomposed and reordered marks all compare the same. đ is a letter of its own:
    "dụ" is not the listed word with đ;
  - **without marks** — English words and Vietnamese teen code that means nothing else (`dcm`, `vcl`…), compared without
    marks or case, with `0 1 3 4 5 7 @ $ !` read as `o i e a s t a s i` and full-width letters as plain ones.
- **Whole words**: a word of the name, two side by side (for two-word entries), or single letters typed apart read as
  one ("f u c k"); dots, dashes, emoji inside a word are dropped ("f.u.c.k"). A letter repeated is read at least as
  often as the listed word has it — "fuuuck" is caught, "Niger" is not the slur with two g. A listed word inside a
  longer one is not that word ("Essex", "Dickens").
- **Renames**: the profile's owner renames it at most **5 times in 24 hours** (`Identity:ProfileRenamesPerDay`),
  counted from the name history (every name but its first); saving the same name is not a rename. Beyond:
  `429 rename_limit`. A moderator's rename from the console is not limited (and is counted in the history like any).

## Consequences

- The obvious words are refused; anyone determined writes them another way, and a moderator still renames what slips
  through. The list will grow with what moderators see — each change a reviewed PR.
- False refusals are possible (initials like "DCM"); the message says to pick another name, and the list can lose a
  word.
- Existing names are not checked again; a moderator renames one that is rude.
- The hub learns two codes, `name_inappropriate` and `rename_limit`; the word list lives only in the API.

## Alternatives considered

- **Strip marks and match** (the common approach): refuses everyday Vietnamese — "lớn", "các", "đi".
- **Match inside words** (substrings): refuses "Essex", "Dickens", "Scunthorpe" — the classic failure.
- **An external moderation service**: a third party seeing every name, for a family platform's scale (E-07 keeps
  everything in house).
- **No filter, moderation only**: a rude name is public until someone reports it — and the report button comes after
  launch.
