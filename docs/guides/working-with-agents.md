---
title: Working with agents
description: How AI agents (and humans) are expected to work in this repository.
sidebar:
  order: 3
---

This repository is built to be changed by AI agents under human review. These rules keep the design coherent
across many sessions. `AGENTS.md` at the repository root points here; keep that file short.

## Read before you change

1. [Overview](../index.md) — the system and its principles.
2. The pages for the area you touch: [architecture](../architecture/overview.md),
   [Game Contract](../contracts/game-contract-v1.md), [Platform API](../contracts/platform-api.md).
3. The [decisions](../decisions/index.md) that mention it. An accepted ADR is binding until superseded.
4. [Definition of Done](../conventions/definition-of-done.md).

## How to change things

- **Spec first.** For anything bigger than a bug fix, write or update the doc (or a game's `SPEC.md`) before the
  code, and get it reviewed.
- **ADR for decisions that are expensive to reverse:** the contract, a new technology, a new origin or service,
  data ownership, security boundaries. Use `/new-adr` or copy
  [`decisions/0000-template.md`](../decisions/0000-template.md).
- **Small pull requests** with one purpose. Conventional Commit messages (`feat(hub): …`).
- **Never weaken a check to make it pass** — not the conformance kit, not a test, not the CSP, not the pnpm
  release-age policy. If a check is wrong, fix it in its own change with a reason.
- **Generated files are regenerated, never edited** (OpenAPI document, API types, JSON Schemas).
- **Keep docs true.** If behaviour changes, the page describing it changes in the same PR.

## Skills

| Skill | Use it to |
| --- | --- |
| `/new-game` | Create a game from an idea: spec → review → logic + tests → view → conformance. |
| `/new-adr` | Record a decision with the next free number. |
| `/verify` | Run the full Definition of Done locally and report. |

## Environment rules

- Use only the Tò He stack (ports 47xx, the `tohe` compose project, the `tohe` database). Never touch other
  databases or containers on the machine.
- Secrets never go into the repository. Local defaults (`tohe-dev-only`) are for local containers only.
- Tests that need a database use Testcontainers, never a shared instance.
