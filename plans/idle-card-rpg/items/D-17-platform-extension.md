# D-17 — Platform extension package (decided: P0)

**Status:** decided — owner chose **P0 tối thiểu** on 2026-11-09 · **Kind:** decision · **Blocked by:** D-02

## Decision (owner's words)

> "P0 tối thiểu (Recommended)"

The platform extension package is **P0**:

1. **E-01 persistent shell** — a `persistent` option in the game-kit shell (no "Ván mới").
2. **Asset on-demand** — the game declares `delivery: on-demand`; the hub fetches packs after first paint; offline cache keeps the last copy.
3. **Save envelope 256 KB** — a versioned envelope; the API/hub accept 256 KB; 64 KB stays the default for other games.

**Not in P0:** content packs/remote content (P1), save conflict merge, ranked daily boss, server time, push (P2), music (D-15 chose SFX only). The first playable does not wait for them.

## What the game can rely on

- A persistent shell (no "Ván mới", title says "Chơi tiếp").
- On-demand assets, so the art library can grow without inflating the first load.
- A 256 KB save envelope from day one; the game owns migrations.
- Content ships in the immutable build for v1; content packs are a later path.
- No public leaderboard, no ranked run, no push, no music in v1.

## Options considered (history)

| Option | Why not chosen |
|---|---|
| **P0 minimal enablers** | **Chosen.** Shell + on-demand assets + 256 KB save. |
| **P1 live-content platform** | Deferred: content packs are a big platform bet; prove the loop first. |
| **P2 full platform** | Deferred: conflict merge, ranked boss, server time, push are not v1 needs. |

- **D-03**: the technical foundation targets the extended platform (asset loader, save envelope, content in build).
- **D-06/D-07**: the save schema uses the envelope from day one; the economy can grow past 64 KB.
- **D-11**: the content pipeline is "data in the build" for v1; content packs are a later path.
- **D-16**: the first playable is gated by P0, not by P1/P2.
- **Graduation**: platform ADRs/PRs (save size, asset delivery) + kit PRs (E-01, E-03) precede the game's implementation.

## Risks

- **Platform drift.** A platform program can delay the game indefinitely. Timebox P0; ship the first playable on P0; revisit P1 with evidence.
- **Contract churn.** Save size and asset delivery need ADRs, docs, conformance and migration; do them once, carefully.
- **Over-building.** Content packs, push and ranked are easy to add "for the future"; each must be earned by a game need.
- **Offline complexity.** On-demand assets and content packs add "not loaded yet" states; the game must stay playable offline with the last copy.

## Evidence

- [R-05 — Platform extension options](../research/R-05-platform-extension.md).
- [R-04 — Platform fit](../research/R-04-platform-fit.md).
- ADR 0051 (asset delivery), `docs/architecture/progress-sync.md` (64 KB, last write wins), `packages/game-kit/src/shell.ts`.

## Discussion

**owner (2026-11-09):** chose P0 tối thiểu.

**agent (2026-11-09):** recorded. P0 is the smallest package that unblocks a large RPG without turning the plan into a platform rewrite. Content packs (P1) should wait for evidence that the loop retains players. Music was removed from P0 after D-15 chose SFX only. The platform work needs its own ADRs and conformance in the same PRs; the game's first playable is gated by P0, not P1/P2.
