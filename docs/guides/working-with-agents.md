---
title: Working with agents
description: How AI agents (and humans) are expected to work in this repository.
sidebar:
  order: 3
---

This repository is built to be changed by AI agents under human review. These rules keep the design coherent
across many sessions. `AGENTS.md` at the repository root points here; keep that file short. The loop, the gates and
the stop rules are in [How work runs](opencode-workflow.md).

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
| `/new-asset` | Make an asset pack for the Studio: style → import or draw → prepare → check → submit for review. |
| `/packet` | Hand work to a worker: choose it and the model it runs, claim the paths, open its worktree, check its diff. |

## Environment rules

- Use only the Tò He stack (ports 47xx, the `tohe` compose project, the `tohe` database). Never touch other
  databases or containers on the machine.
- Secrets never go into the repository. Local defaults (`tohe-dev-only`) are for local containers only.
- Tests that need a database use Testcontainers, never a shared instance.
- UAT holds the family's data. Deploy only with `deploy/uat/deploy.sh <tag>`, a `uat-` tag on `main`, and only when the
  owner says "deploy". Never wipe its volume or run migrations against it by hand ([UAT](uat.md)).
- Production (`toheplay.io.vn`) is read from outside only; an agent never writes to its cluster. The one exception: an
  agent creates drafts in the [Asset Studio](../architecture/asset-studio.md) through the API, with a token holding
  `studio.draft`; it never approves, deprecates or withdraws, and the owner can revoke the token at any moment
  ([ADR 0051](../decisions/0051-an-asset-studio-for-game-assets.md), [ADR 0052](../decisions/0052-agent-tokens-and-the-scopes-no-agent-gets.md)). A release is a `prod-`
  tag on a commit that already has a `uat-` tag, made when the owner says "lên prod". In `platform-infra` an agent may
  open pull requests; the only one it merges is the one that changes `targetRevision` of `apps/tohe`. Pull requests in
  this repository are merged when the owner says "merge". The steps, the tag rules and the checks are in
  [Environments and releases](environments.md)
  ([ADR 0041](../decisions/0041-promote-one-build-through-the-environments-by-tag.md)).

## Agents and models

Work is split between one main session, the master, and short-lived workers. The roles are the same whichever tool
runs them: `.claude/agents/` holds the definitions for Claude Code, `.opencode/agents/` for opencode.

**The master** is the main session. It talks with the owner and settles decisions, writes a work packet for each
worker, and is the only one that edits shared notes. It reviews every diff, re-runs the gates, commits, opens pull
requests, and merges, tags and deploys on the owner's word.

**The workers:**

| Worker | Does | May |
| --- | --- | --- |
| `scout` | Searches code, logs, docs and the web; reads CI and test output | Read only |
| `builder` | Builds one pull request from a work packet | Edit files in its worktree; never commits or pushes |
| `chore` | Mechanical changes: renames, regenerating files, CI fixes, dependency bumps | Edit files in its worktree; never commits or pushes |
| `reviewer` | Reviews ADRs, specs and diffs against the accepted decisions | Read only |

Workers do not commit: the master reviews the uncommitted diff and commits it, so every commit has passed the master's
review.

**Model.** The owner chooses the model for a session. `.opencode/agents/` inherit it; `.claude/agents/` name their
own. Each pull request names the model, the workers and the rounds. The gates, not the model's name, decide whether the
work is done.

**Rules:**

- One builder per pull request. Never split one pull request between agents.
- Small work the master does itself.
- At most four workers at a time, and side by side only when their claims do not touch: `pnpm claims open` decides,
  and work whose claims touch runs after the other ([Claims](#claims-who-changes-what)).
- Never two workers at once on EF Core migrations, generated files, the lockfile, the hub's router, Caddy or the dev
  stack. These are the hot zones in `tools/claims/src/zones.ts`, and `pnpm claims open` refuses the second.
- Workers never commit, push, open pull requests, merge, deploy, touch UAT or production, or decide a design question.
  They stop and report it.
- The master checks every report against the diff and the checks.
- A worker whose checks fail gets its report back once, with the errors. After a second failure the master finishes
  the work itself.

**A work packet holds:**

- the goal;
- the decisions and docs it implements;
- scope, in and out;
- the claims: the narrowest paths it may change, and `@dev-stack` when it runs the stack;
- done-when: tests, the gates, docs;
- constraints;
- the worktree, and the worker (and the model, when the session names one);
- the report to return: what changed, check output, deviations, open questions.

The loop, the risk tiers, the research depth, the gates, the review checklist, the stop rules and the metrics
are in [How work runs](opencode-workflow.md).

### Claims: who changes what

A claim names the paths one worker may change: `dir/` for everything under it, a file, or a pattern with `*`, `**` or
`?`. `@dev-stack` claims the one dev stack, which the e2e suites and `docker compose` share. The master writes the
claims into the packet and opens the worker's worktree with them, so two workers run side by side only when their
claims do not touch.

1. `git fetch origin`, then `git worktree add .claude/worktrees/<name> -b <branch> origin/main`.
2. `pnpm claims open .claude/worktrees/<name> <claim>...` writes `.agent-claims` into the worktree's root. It refuses
   when a claim touches one of an open worktree: two claims that can name the same file, or two that reach the same hot
   zone. The master then runs the work after that worktree, or splits it so the claims do not touch. `open` on the same
   worktree again widens its claims, with the same check.
3. In Claude Code, the worker's hooks keep it inside its claims. An edit outside them, in another worktree or in the
   main checkout is blocked, and so are the commands a worker may not run: commit, push, `gh pr`, `kubectl`, deploys,
   the UAT and production hosts. The hooks match what the worker writes, so they prevent accidents; they are not a
   security boundary. In opencode there is no hook yet: the master runs `pnpm claims open/check/close` by hand
   ([ADR 0056](../decisions/0056-make-the-agent-workflow-tool-neutral.md)).
4. Before committing a worker's diff, the master runs `pnpm claims check .claude/worktrees/<name>`. It lists the files
   changed outside the claims (through Bash or a generator), the files another open worktree also changed, and the
   files `origin/main` changed since the worktree started, which need `origin/main` merged first. Each finding is the
   master's call: widen the claims, move the change, or run the work after the other.
5. A worktree's claims stop counting once its branch is in `origin/main`; `pnpm claims status` shows them as merged.
   `pnpm claims close` drops them sooner, when the work is dropped.

**Claim narrowly.** `apps/hub/src/features/play/` runs beside `apps/hub/src/features/account/`, but `apps/hub/`
touches both, and it reaches the lockfile through `apps/hub/package.json`. Two claims with wildcards are compared
segment by segment, and when they could meet the tool says they touch.

**Four at most**, because the master reviews every diff and re-runs its checks, and more workers use up the plan's
usage window sooner without making the work cheaper.

**The hooks and the definitions load from the master's checkout**: `${CLAUDE_PROJECT_DIR}/tools/claims` and
`.claude/agents/`. Start the master in a checkout of `main`: on an older branch it spawns the older workers, and
without `tools/claims` they run unguarded. A worker spawned as `general-purpose`, not by its name, has no hooks either.
