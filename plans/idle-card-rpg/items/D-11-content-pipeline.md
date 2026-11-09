# D-11 — Content pipeline: TypeScript catalogs + balance simulation

**Status:** decided — owner chose **TS catalogs + sim** on 2026-11-09 · **Kind:** decision · **Blocked by:** D-03, D-09

## Decision (owner's words)

> "TS catalogs + sim (Recommended)"

- **Content as typed TypeScript catalogs**, using `defineCatalog` from `@tohe/game-kit/content`:
  - `content/heroes.ts`, `skills.ts`, `enemies.ts`, `regions.ts`, `stages.ts`, `loot.ts`, `modes.ts`, `fx.ts`.
  - Each item has a literal `id`; references are typed (`IdOf<typeof heroes>`).
- **Zod schemas in tests**, not at runtime: `checkSchema` + `checkReferences`; the bundle never validates content.
- **Balance simulation** in Node: the same pure battle/progression logic; bots/teams play the 48 stages; report win rate, time-to-clear, power curve, economy sources/sinks. A test fails if a stage is unwinnable at the intended power or trivial.
- **Art**: Studio packs; FX via pixelfx sprite sheets + `act` sidecar (R-08).
- **Authoring**: agents edit TS, run tests/sim; a debug screen (`#content`) lists heroes/stages and previews cards; no spreadsheet in v1.

## Why

- The owner wants **content to be the strength**; typed data + a sim is how content stays cheap to add and safe to balance.
- TypeScript catalogs are the smallest pipeline that gives type safety, reference checks and a single source for game + sim; no extra loader, no runtime schema cost.
- The game-kit already ships `defineCatalog`, `checkReferences`, `checkSchema` (`packages/game-kit/src/content/index.ts`).
- A simulation is non-negotiable for 6 heroes × 48 stages; without it, the two-week pacing is guesswork.

## What it changes

- **D-03**: pure TS core + data; the sim imports the same modules.
- **D-06/D-07**: the sim tunes the company/star/gear curves and the economy.
- **D-09**: stages/regions are data records, not code.
- **D-16**: the first content slice is chapter 1 + 6 heroes; the sim runs before art lock.
- **Graduation**: a `content.test.ts`, `balance.ts` script, and a `#content` debug screen.

## Open (implementation details)

- Exact catalog fields and schemas; how loot tables reference gear sets.
- Sim coverage: how many team compositions, how much randomness, what counts as "intended power".
- Whether the debug screen is a dev-only route or a hidden game screen.
- Whether a future spreadsheet/CSV importer is worth it (not v1).

## Evidence

- Owner's words, 2026-11-09.
- `packages/game-kit/src/content/index.ts` (catalogs, references, schema checks).
- [R-02 — Progression & economy](../research/R-02-progression-economy.md): the one-week pacing targets.
- [R-08 — Pixel FX](../research/R-08-pixel-fx.md): FX sheet/act sidecar.

## Discussion

**owner (2026-11-09):** chose TS catalogs + sim.

**agent (2026-11-09):** recorded. This is the right foundation for a content-led game: typed data, reference checks, and a sim that can prove the week before art is produced. It also keeps the door open for a JSON/spreadsheet importer later without changing the runtime.
