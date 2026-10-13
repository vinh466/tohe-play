---
title: Upgrade watchlist
description: Upgrades that are deliberately on hold, why, and what unblocks each one.
sidebar:
  order: 2
---

Some upgrades cannot be taken yet because something else in the stack does not support them. They are kept
visible on purpose: the matching Dependabot pull requests stay **open as reminders** (do not close them, do not
add Dependabot ignore rules for them). Before merging any dependency upgrade, check this table.

When an item is unblocked: upgrade it in its own pull request, run `pnpm verify` and the e2e smoke test, update
this page (remove the row) and any ADR that names the old version.

| Item | Reminder | Held because | Unblocked when | Upgrade notes |
| --- | --- | --- | --- | --- |
| `mermaid` 11 → 12 | Dependabot [#4](https://github.com/vinh466/tohe-play/pull/4) | `astro-mermaid` 2.1 only accepts `mermaid` `^10 \|\| ^11` (peer dependency). | `astro-mermaid` releases support for mermaid 12. | Bump both together; build the site and check that the diagrams on the architecture pages still render. |
| `@types/node` 24 → 26 | Dependabot [#5](https://github.com/vinh466/tohe-play/pull/5) | Node types must match the Node runtime, which is 24 for development and CI (`.nvmrc`). | The project moves to Node 26 (row below). | Merge together with the Node 26 alignment. |
| TypeScript 7 in `tools/codegen` | Dependabot [#6](https://github.com/vinh466/tohe-play/pull/6) | `openapi-typescript` needs the classic TypeScript compiler API (peer `typescript ^5.x`); TS 7 has none. See [ADR 0008](../decisions/0008-technology-baseline.md). | `openapi-typescript` supports TypeScript 7, or is replaced by a generator that does. | After the bump, `pnpm --filter @tohe/hub generate:api` must produce no diff. The rest of the repo already uses TS 7. |
| Node 26 everywhere | — | Since [#2](https://github.com/vinh466/tohe-play/pull/2) the Docker build stage of the web images uses Node 26, while `.nvmrc`, CI and ADR 0008 say Node 24 LTS. | Node 26 becomes LTS (expected late October 2026). | One PR: `.nvmrc`, `engines` in `package.json`, `@types/node` (#5), a new ADR superseding the Node line of ADR 0008. |
| TypeDoc for the SDK reference | — | TypeDoc supports TypeScript ≤ 6.0 only; the SDK reference is hand-written in the [Game Contract](../contracts/game-contract-v1.md). | TypeDoc supports TypeScript 7. | Add `starlight-typedoc` to the site, generate from `packages/game-sdk`. |

_Last reviewed: 2026-10-13._
