---
title: "0048: Give each game a standard name, and a name and a description per language when it has them"
description: A game's manifest keeps `name` as its standard name — English, or a proper name such as Tiến Lên — and gains optional `names` and `descriptions`, maps from a language tag to the words in that language; the platform shows the reader's language when the game has it (the exact tag, then its primary subtag, then the standard words). Additive in protocol 1.
sidebar:
  order: 48
---

- **Status:** Accepted — the points marked *(agent)* wait for the owner's review in the pull request
- **Date:** 2026-10-22
- **Amends:** [ADR 0047](0047-two-languages-and-an-introduction-surface-that-grows.md) — settles what it left open:
  game names per language, and descriptions *(agent)*
- **Decided by:** the owner, 2026-10-22, in the launch review: a manifest's `name` is the game's **standard name** —
  English, or a proper name such as *Tiến Lên* — required and shown by default; a name per language is **optional and
  shown when present**. Proper names and established terms stay English inside Vietnamese text. Descriptions, the
  language tags, the lookup's order, the four games' names and where the repository's own rule is tested are the
  agent's proposal, marked *(agent)*.

## Context

- **The manifest today** carries one `name` (≤ 40 characters) and one `description` (≤ 200, shown in the catalog and on
  the game's public page), both in Vietnamese for the four games. The hub speaks Vietnamese and English (ADR 0047), the
  console English, the public pages Vietnamese and soon English; the link previews Vietnamese.
- **Games already speak several languages** inside: they receive `init.locale` (`vi` or `en` from the hub) and carry
  their own strings, and their room options carry `label: { vi, en }` (ADR 0016). Only the manifest has one language.
- **ADR 0047** decided that Vietnamese is the face and English the support, that proper names and established terms stay
  English inside Vietnamese text, and that the Game Contract gains names per language in its own ADR — leaving
  descriptions to the owner.
- **The registry** (the API) keeps each build's name and description as columns and returns them with each game; link
  previews put the name in their title; the console lists games by name.
- A game added later may come with a third language of its own (ADR 0047: "a game may add a third language on its
  own"), while the hub and the public pages speak two.

## Decision

### The manifest

All of it is **additive in protocol 1**: a manifest without the new fields means what it meant before.

| Field | Type | Means |
| --- | --- | --- |
| `name` | string, 1–40 | The **standard name**: English, or a proper name such as *Tiến Lên*. Required. Shown when the reader's language has no name of its own. |
| `names` | map: language tag → string, 1–40 each, at most 10 | *Optional.* The name in a language, when it differs from the standard one: `{ "vi": "Ghép Khối" }`. |
| `description` | string, ≤ 200 | The **standard description**, shown when the reader's language has none. |
| `descriptions` | map: language tag → string, 1–200 each, at most 10 | *(agent)* *Optional.* The description in a language, when it differs from the standard one: `{ "vi": "…" }`. |

**Language tags** *(agent)* are the BCP 47 tags `init.locale` carries, limited to a language, an optional script and an
optional region, in their canonical case: `vi`, `en`, `en-GB`, `zh-Hant`, `es-419` — two or three lower-case letters,
then optionally four letters with the first upper-case, then optionally two upper-case letters or three digits, joined by
`-`. Anything else (`EN`, `en_GB`, `english`, `x-klingon`) makes the manifest invalid. Every value is non-empty.

**The lookup** *(agent)*, for a reader's language: the exact tag, then its primary subtag (`en-GB` → `en`), then the
standard `name` or `description`. Tags compare without regard to case, and `_` reads as `-`, so a browser's `en_us`
finds `en-US`. A region's map entry is not found from the bare language (`en` does not find `en-GB`): a game that wants
English for everyone writes `en`. The contract exports the lookup (`gameName`, `gameDescription`, and `inLanguage` for
any such map) so the hub and the public pages share one implementation; the API keeps its own copy (`GameWords`), with
the same cases tested. The game side of the SDK, which has no runtime dependencies, needs none: games are not sent their
names.

### Descriptions *(agent)*

`descriptions` has the same shape and the same lookup as `names`, and `description` stays as the fallback — so the
change stays additive and a game written for one language keeps working with one string. **What `description` holds**:
the standard language, as `name` does — English for the four games. A reader of neither of the hub's languages reads
English more easily (ADR 0047 sends them to `/en/`), and the unmarked fields of a manifest are then one language, the one
anyone outside Tò He reads it in.

### The games in this repository *(agent)*

Not a contract rule — a game made elsewhere may speak one language — but a rule of this repository, where the hub and
the public pages speak Vietnamese and English: every game under `games/` has `descriptions.vi`, its `description` being
the English one, so both languages are written once each. A Vietnamese name stays optional, as the owner decided for
names: `names.vi` when the game has one. **Where it is tested**: in the games assembler,
`tools/games-host` (`src/games.test.ts`), the package that already gathers every game of the repository and refuses one
it does not know — the lowest level that sees all of them; the contract and the conformance kit stay free of it.

| Game | `name` | `names.vi` |
| --- | --- | --- |
| `merge-block` | Merge Blocks | Ghép Khối |
| `tap-merge` | Tap Merge | Chạm Ghép |
| `tien-len` | Tiến Lên | — |
| `hello` | Tap Dot | Chạm Chấm |

Their Vietnamese descriptions move to `descriptions.vi`; the English ones are new and go in `description`. Each
game takes a new patch version, since a published change is a new build. The games' own titles already read these
names in each language, but the sample's English title, "Tap the Dot", becomes "Tap Dot", so a name is the same
everywhere (ADR 0047).

### Where each surface reads them

- **The hub**: every name and description of a game it shows — the catalog, the game's frame, rooms, sharing,
  leaderboards, link pages and the sheets a game asks for — through the lookup in its current language. Its language is
  still the browser's (ADR 0047's setting comes later).
- **The API**: the registry keeps `names` and `descriptions` with each build (JSON columns, an additive migration),
  fills them from the catalog, dropping an entry that breaks the rules above, and returns them with each game; a link
  it resolves carries the game's names too. **Link previews** speak Vietnamese for now: `names.vi`, else `name`, until
  ADR 0047's previews in the maker's language.
- **The console** speaks English: the standard `name`.
- **The public pages**: the lookup in the page's language — Vietnamese at `/…`, English at `/en/…` (ADR 0047).
- **Games** are not sent their names: a game has its own title in its own strings.

### Not done

- No language for `tags`, which the public pages already put in words of their own.
- No name or description for a language the platform does not speak being checked for — a game may carry a third one.
- No rule that a name per language differs from the standard one.
- No third language in the hub or the public pages (ADR 0047).

## Consequences

- `packages/contract`: `LanguageTag`, `names`, `descriptions` and the lookup; their tests; the JSON Schema regenerated.
  The SDK neither sends nor reads a manifest's names, so it does not change.
- Conformance checks a manifest's tags and lengths with the contract's schema (check 1, "game.json is valid").
- The API: registry columns for `names` and `descriptions`, read by `CatalogSync` and returned with each game and with
  a resolved link; previews in Vietnamese; the OpenAPI document and the clients' types regenerated; tests on
  PostgreSQL.
- The hub shows the lookup everywhere it names or describes a game; the console the standard name; each public page
  the lookup in its language.
- The four games: `names` and `descriptions`, a patch version each; the sample's English title follows its name.
- `tools/games-host`: the repository's rule above, tested.
- Docs: [Game Contract v1](../contracts/game-contract-v1.md) (the manifest and versioning), [Create a
  game](../guides/create-a-game.md), the `/new-game` skill, [Surfaces](../architecture/surfaces.md) ("Where things
  stand"), [Entry links](../architecture/entry-links.md) (the cards' and the intent's names). ADR 0047's status line
  notes this ADR.

## Alternatives considered

- **`name` in Vietnamese, the other languages beside it.** What the four games did; but it makes the Vietnamese name the
  one a stranger, a crawler of the English pages or another language's reader sees, and a proper name like *Tiến Lên*
  would be written twice. Lost to the owner's standard name.
- **A required name per platform language** (`name: { vi, en }`, like room options). Every game would write *Tiến Lên*
  twice, a game made elsewhere could not speak only English, and the hub's two languages would be frozen into the
  contract. Lost to a standard name and optional names.
- **`description` becoming a map** (`description: { vi, en }`). Breaks every v1 manifest: a new protocol number.
  Lost to `descriptions` beside it *(agent)*.
- **`description` holding the Vietnamese text.** Fewer copies of the English one, but the unmarked fields would be two
  languages (an English name, a Vietnamese description) and a reader of a third language would read Vietnamese. Lost
  *(agent)*.
- **The repository's rule in the contract or the conformance kit.** It would force two languages on every game made
  anywhere. Lost to a test in the assembler *(agent)*.
- **Requiring `names.vi` when the standard name is not Vietnamese.** Telling a Vietnamese name from another needs a
  flag in the manifest or a guess from its letters, and the owner made names per language optional; lost *(agent)*.
- **`descriptions.en` beside an English `description`.** The same words twice in one file; lost to `description` as the
  English one *(agent)*.
- **Free-form language keys.** Typos (`VI`, `vn`) would never be found by the lookup and nobody would notice; lost to
  tags checked by the schema.
