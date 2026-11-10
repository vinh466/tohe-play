# D-02 — Platform fit: extend the platform first

**Status:** decided — owner chose **"Mở rộng nền tảng trước"** on 2026-11-09; the scope is D-17 · **Kind:** decision · **Blocked by:** D-01

## Decision (owner's words)

> "Mở rộng nền tảng trước"

The game will **not** be squeezed into the current limits first. The platform gets the extensions a large, long-lived RPG needs, and the game is designed against the extended platform. The exact package, order and cost are **D-17**; this item records the direction and the facts that constrain it.

## What "extend" can mean — candidate extensions

| Candidate | Why the game wants it | Touches | Rough cost |
|---|---|---|---|
| **E-01 persistent-game shell** | A world is not a "run"; the panel must not offer "Ván mới" | `@tohe/game-kit` only | Small |
| **Asset on-demand delivery** | A live RPG accumulates heroes, enemies, backgrounds, audio; bundling everything inflates the first load | Contract (ADR 0051's future values), Studio, hub loader, conformance | Medium |
| **Content packs / remote content** | Add chapters, heroes, events without a new immutable build | Contract, API, storage, hub, conformance, ADR | Large |
| **Save > 64 KB + versioned envelope** | A long-lived roster/gear/event state may outgrow 64 KB; migrations need room | Contract, API, hub, docs, ADR | Medium |
| **Save conflict handling** | Two offline devices can overwrite each other (last write wins today) | API, hub, contract semantics | Medium |
| **Music / audio helper** | A 1-week RPG wants a theme and a battle loop, not only SFX | `@tohe/game-kit` | Small |
| **Ranked daily boss / boards** | A deterministic daily boss run could use the existing `ranked`+`scores`; the board UI exists | Game + existing platform; maybe a board label | Small–medium |
| **Push notifications** | Idle chest reminders; optional, and against Tò He's calm tone | PWA/service worker, API, consent | Medium–large |

## What must stay true

Whatever is extended, these do not change:

- No ads, no in-app purchases, no tracking.
- Games are sandboxed; no game calls the API directly; no `localStorage` of its own.
- Offline-first: play, save and score without a network; sync later.
- Immutable builds; a published version never changes.
- One origin per game; the Game Contract is the only interface.
- The owner's approval rule for contract changes: ADR + docs + conformance in the same PR.

## Recommendation

Stage the extensions; do not turn the game into a platform rewrite.

1. **P0 — unblock the game (must):** E-01 persistent shell; decide whether the first playable uses bundled assets or on-demand assets.
2. **P1 — make it live (should):** asset on-demand; content packs or a documented "new build per content drop" pipeline; save envelope with room to grow.
3. **P2 — long-lived (later):** save conflict handling, ranked daily boss, push/music.

D-17 chooses the exact P0/P1 package and their order. The game's first playable should not wait for P2.

## Why the owner's choice changes the plan

- The original recommendation (adapt to 64 KB / 4.5 MB) is **withdrawn**. The game's save/build design will use the new limits once D-17 sets them.
- D-03 (technical foundation), D-06 (save schema), D-07 (economy) and D-11 (content pipeline) now depend on D-17.
- The graduation list will include platform ADRs and PRs, not only the game.

## Evidence

- [R-04 — Platform fit](../research/R-04-platform-fit.md): current facts; the shell gap; the size/save estimates.
- [R-05 — Platform extension options](../research/R-05-platform-extension.md): the candidate packages and their costs.
- ADR 0051 (asset delivery: `bundle` now, `precache`/`on-demand` later).
- `docs/contracts/game-contract-v1.md`, `docs/architecture/progress-sync.md`, `docs/architecture/game-shell.md`.

## Discussion

**owner (2026-11-09):** chose "Mở rộng nền tảng trước".

**agent (2026-11-09):** recorded. The risk is scope: a platform program can delay the game indefinitely. The plan should timebox P0/P1, define a "good enough" platform for the first playable, and keep each extension tied to a game need. D-17 is the place to make that trade-off explicit.
