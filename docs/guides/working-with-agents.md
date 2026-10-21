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
| `/health-report` | Read the device telemetry report (ADR 0015) and turn it into findings and proposed fixes. |

## Environment rules

- Use only the Tò He stack (ports 47xx, the `tohe` compose project, the `tohe` database). Never touch other
  databases or containers on the machine.
- Secrets never go into the repository. Local defaults (`tohe-dev-only`) are for local containers only.
- Tests that need a database use Testcontainers, never a shared instance.
- UAT holds the family's data. Deploy only with `deploy/uat/deploy.sh <tag>`, a `uat-` tag on `main`, and only when the
  owner says "deploy". Never wipe its volume or run migrations against it by hand ([UAT](uat.md)).
- Production (`toheplay.io.vn`) is read from outside only; an agent never writes to its cluster. A release is a `prod-`
  tag on a commit that already has a `uat-` tag, made when the owner says "lên prod". In `platform-infra` an agent may
  open pull requests; the only one it merges is the one that changes `targetRevision` of `apps/tohe`. Pull requests in
  this repository are merged when the owner says "merge". The steps, the tag rules and the checks are in
  [Environments and releases](environments.md)
  ([ADR 0041](../decisions/0041-promote-one-build-through-the-environments-by-tag.md)).

## Agents and models

Work is split between one main session, the master, and short-lived workers. The workers are defined in
`.claude/agents/`.

**The master** is the main session. It talks with the owner and settles decisions, writes a work packet for each
worker, and is the only one that edits shared notes. It reviews every diff, re-runs `pnpm verify`, commits, opens pull
requests, and tags and deploys on the owner's word.

**The workers:**

| Worker | Model | Effort | Does | May |
| --- | --- | --- | --- | --- |
| `scout` | Claude Opus 5.5 | low | Searches code, logs, docs and the web | Read only |
| `builder` | Claude Opus 5.5 | high | Builds one pull request from a work packet | Edit files in its worktree; never commits |
| `chore` | Claude Opus 5.5 | medium | Mechanical changes: renames, regenerating files, CI fixes, dependency bumps | Edit files in its worktree; never commits |
| `reviewer` | Claude Opus 5.5 | high | Reviews ADRs, specs and diffs against the accepted decisions | Read only |

The definitions name the full model ID (`claude-opus-5-5`), so an alias cannot drift to another model. Workers do not commit: the master reviews the uncommitted diff and commits it, so every
commit has passed the master's review.

**Cost ceiling** (the owner's): every worker runs Claude Opus 5.5 at an effort of `high` or less; only the main session
runs at `xhigh`. Nothing above Claude Opus 5.5, no Claude Fable, no `max`, no fast mode.

**Rules:**

- One builder per pull request. Never split one pull request between agents.
- Small work the master does itself.
- At most two workers at a time.
- Never two workers at once on EF Core migrations, generated files, or the hub's router or Caddy.
- Workers never commit, push, open pull requests, merge, deploy, touch UAT or production, or decide a design question.
  They stop and report it.
- The master checks every report against the diff and the checks.
- A worker whose checks fail gets its report back once, with the errors. After a second failure the master finishes
  the work itself.

**A work packet holds:**

- the goal;
- the decisions and docs it implements;
- scope, in and out;
- the files likely touched;
- done-when: tests, `pnpm verify`, docs;
- constraints;
- the worktree;
- the report to return: what changed, check output, deviations, open questions.
