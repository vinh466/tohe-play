# D-17 — Platform extension package

**Status:** proposed — chờ owner chốt · **Kind:** decision · **Blocked by:** D-02

## Question

"Mở rộng nền tảng trước" cụ thể là mở rộng gì, theo thứ tự nào, và bản chơi được đầu tiên được phép dựa vào những gì?

## Options

### A — Minimal enablers (P0, recommended)

1. **E-01 persistent shell** — a `persistent` option in the game-kit shell (no "Ván mới").
2. **Asset on-demand** — the game declares `delivery: on-demand`; the hub fetches packs after first paint; offline cache keeps the last copy.
3. **Save envelope 256 KB** — a versioned envelope; the API/hub accept 256 KB; 64 KB stays the default for other games.
4. **Music helper** — a small kit helper for loops/fades.

**Game gets:** a persistent world, a large art library, a long-lived save, a soundtrack. **Not:** content without a new build, remote events, push.

**Cost:** one contract change (save size), asset-delivery work across contract/Studio/hub/conformance, two kit PRs. **Timebox:** the first playable should not wait for content packs.

### B — Live-content platform (P1)

A + **content packs** + remote content delivery + offline cache:

- A chapter/hero/event is a versioned content pack, not a game build.
- New contract surface, API module, storage, hub loader, SDK, conformance, docs, ADR.
- The game must handle missing/stale packs and offline.

**Game gets:** weekly content without a release. **Cost:** the biggest platform project; it commits the owner to a live-content cadence.

### C — Full platform (P2)

B + save conflict merge + ranked daily boss + server time + push. Only if the game proves it needs competition/reminders. Push is against the calm tone.

## Recommendation

**A now; B only after the first playable proves the loop; C later.** The first playable needs the shell, assets and save headroom. Content packs are a platform bet that should be made with evidence, not before the game exists.

Concretely, the first playable may rely on:

- a persistent shell (E-01);
- bundled assets **or** on-demand assets (decide in D-17; on-demand is preferred if the art library is expected to grow past ~10 MB);
- a 256 KB save envelope;
- no content packs; content ships in the immutable build;
- no ranked/board, no push;
- music if the kit helper lands in time.

## What it changes

- **D-03**: the technical foundation targets the extended platform (asset loader, save envelope, content in build).
- **D-06/D-07**: the save schema uses the envelope from day one; the economy can grow past 64 KB.
- **D-11**: the content pipeline is "data in the build" for v1; content packs are a later path.
- **D-16**: the first playable is gated by P0, not by P1/P2.
- **Graduation**: platform ADRs/PRs (save size, asset delivery) + kit PRs (E-01, music) precede the game's implementation.

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

**agent (2026-11-09):** recommend A. The owner chose to extend first; the smallest extension that actually unblocks a large RPG is the shell + assets + save headroom + music. Content packs are the right P1, but only after the loop is proven. If the owner wants a weekly-content game from day one, B moves to P0 — that is a different product plan and should be decided explicitly.

**owner:** _chưa trả lời._
