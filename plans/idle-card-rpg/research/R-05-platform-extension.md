# R-05 — Platform extension options

Date: 2026-11-09 · Status: first pass

Question: nếu mở rộng nền tảng trước, cần mở rộng **cái gì**, theo thứ tự nào, và cái gì là đủ cho bản chơi được đầu tiên?

## The game's real needs

| Need | Why | Current platform | Gap? |
|---|---|---|---|
| **A persistent world** | Camp/roster/road, not a single run; the panel must not offer "Ván mới" | Shell assumes a run | **Yes — E-01 (kit only)** |
| **A large art/audio library** | 12+ heroes, 12+ enemies, 3 bosses, regions, UI, music; grows with content | Asset packs are bundled (`bundle` only); `precache`/`on-demand` are future values | **Yes — asset delivery** |
| **Frequent content** | New chapter/hero/event without waiting for a full game build | Immutable build per version; content is in the build | **Maybe — content packs** |
| **A long-lived save** | Roster, gear, bonds, events; migrations over years | 64 KB JSON, last-write-wins | **Maybe — 256 KB + envelope** |
| **Two devices, offline** | A family plays on a phone and a tablet; both offline | Last write wins; one previous save kept | **Maybe — conflict handling** |
| **Music** | A theme and a battle loop for a 1-week RPG | Kit has SFX; Phaser audio disabled | **Small — kit helper** |
| **A daily boss board** | A reason to compare runs without PvP | `ranked` + `scores` already exist; board UI exists | **No — game can use it** |
| **Idle reminders** | "Your caravan returned" | No push; PWA/service worker | **Optional — against the calm tone** |

## Options

### A — Game-only adaptation (rejected by the owner)

Squeeze into 64 KB / 3–4.5 MB / bundled assets / no content packs. Fastest to a playable, but the owner chose to extend first. Keep as the fallback if the platform work stalls.

### B — Minimal enablers (P0, recommended first)

1. **E-01 persistent shell** (kit): no "Ván mới"; title says "Chơi tiếp".
2. **Asset on-demand delivery** (platform): game declares assets with `delivery: on-demand`; the hub fetches a pack when the game asks; the first load stays small.
3. **Save envelope with 256 KB** (platform): a versioned JSON envelope; the API/hub accept 256 KB; migration is the game's job. Keep 64 KB as the default for other games.
4. **Music helper** (kit): a loop/fade helper on top of WebAudio; no Phaser audio.

**Unlocks:** a large art library, a long-lived save, a persistent world, a soundtrack. **Does not unlock:** content without a new build; remote events; push.

**Cost:** contract change for save size (ADR + conformance + API/hub tests); asset delivery is already an ADR 0051 intent but needs contract/Studio/hub/conformance work; E-01 and music are kit PRs.

### C — Live-content platform (P1)

B + **content packs** + **remote content delivery** + **versioned content cache**:

- A game declares content packs (data-only or data+assets) with versions; the hub fetches them; the game reads them through a new SDK surface; offline cache keeps the last copy.
- New chapter/hero/event = a new content pack, not a new game build; the game's code stays stable.
- Conformance checks the pack schema and references; the API stores/versions packs; the Studio (or a content tool) publishes them.

**Unlocks:** weekly content drops, seasonal events, balance tweaks without a build. **Cost:** a new contract surface, API module, storage, hub loader, SDK, conformance, docs, ADR; the biggest platform project. **Risk:** it turns the game into a live service with a content pipeline; the owner must want that cadence.

### D — Full platform (P2, later)

C + save conflict merge + ranked daily boss + server time + push notifications. Only if the game proves it needs competition/reminders; push is against the calm tone.

## Recommendation

**B first, timeboxed; C only after the first playable proves the loop.**

Reasons:

1. The first playable needs **E-01 + on-demand assets + a save envelope**; without them, the game either feels wrong (shell) or hits a wall (art/save) quickly.
2. **Content packs (C) are the biggest and riskiest project.** The game can ship v1 as an immutable build with data-driven content; if the player keeps coming back, C is the next investment. Building C before the loop is proven risks a platform with no game.
3. **Music** is small and disproportionately improves the feel; do it in P0.
4. **Ranked daily boss** can use the existing platform; no need to extend. Push is optional and should be a separate conversation about tone.

## What the game can rely on at each stage

| Stage | Build | Save | Assets | Content | Shell | Music |
|---|---|---|---|---|---|---|
| **B (P0)** | 4.5–8 MB | 256 KB envelope | on-demand packs | in the build, data-driven | persistent | yes |
| **C (P1)** | small code build | 256 KB | on-demand + content packs | content packs, offline cache | persistent | yes |
| **D (P2)** | same | conflict-aware | same | same | same | same + push |

## Costs and risks

- **Contract changes** (save size, asset delivery, content packs) need ADRs, docs and conformance in the same PR; they are not small.
- **The hub** must handle a game that asks for assets/content after first paint; offline cache and version pinning are the hard parts.
- **The API** must store/version/serve packs; storage and cache invalidation are operational costs.
- **The game** must handle "asset not loaded yet", "content pack missing", "offline with an old pack"; that is real UI work.
- **Platform drift**: a platform program can delay the game indefinitely. Timebox P0; define "good enough"; keep each extension tied to a game need.
- **Conformance**: every new surface needs a check; the kit needs tests; the docs must stay true.

## Open questions for D-17

- Is **content packs** a v1 need, or a v1.1/v2 need? (Recommendation: v2; v1 ships in the build.)
- Is **256 KB** the right save size, or should it be 512 KB / 1 MB? (Recommendation: 256 KB; revisit after a year of content.)
- Is **asset on-demand** worth it for a 4.5–8 MB pixel game? (Recommendation: yes if the game grows past ~10 MB; otherwise `bundle` is simpler.)
- Does the owner want **music** in v1? (Recommendation: yes, 2 loops + SFX.)
- Is a **ranked daily boss** part of v1 or later? (Recommendation: later; v1 uses local records.)
- Does the owner want **push notifications** at all? (Recommendation: no for v1; calm tone.)

## Sources

- [R-04 — Platform fit](R-04-platform-fit.md).
- `docs/contracts/game-contract-v1.md` (save, assets, capabilities).
- ADR 0051 (asset delivery: `bundle` now; `precache`/`on-demand` later).
- `docs/architecture/progress-sync.md` (last write wins, 64 KB).
- `packages/game-kit/src/shell.ts` (the run-oriented panel).
