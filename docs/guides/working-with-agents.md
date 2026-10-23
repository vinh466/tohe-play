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
| `/packet` | Hand work to a worker: choose it and its effort, claim the paths, open its worktree, check its diff. |

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

Work is split between one main session, the master, and short-lived workers. The workers are defined in
`.claude/agents/`.

**The master** is the main session. It talks with the owner and settles decisions, writes a work packet for each
worker, and is the only one that edits shared notes. It reviews every diff, re-runs `pnpm verify`, commits, opens pull
requests, and tags and deploys on the owner's word.

**The workers:**

| Worker | Model | Effort | Does | May |
| --- | --- | --- | --- | --- |
| `scout` | Claude Opus 5.5 | low | Searches code, logs, docs and the web; reads CI and test output | Read only |
| `builder` | Claude Opus 5.5 | medium or high ([below](#choosing-the-effort)) | Builds one pull request from a work packet | Edit files in its worktree; never commits |
| `chore` | Claude Opus 5.5 | medium | Mechanical changes: renames, regenerating files, CI fixes, dependency bumps | Edit files in its worktree; never commits |
| `reviewer` | Claude Opus 5.5 | high | Reviews ADRs, specs and diffs against the accepted decisions | Read only |

The definitions name the full model ID (`claude-opus-5-5`), so an alias cannot drift to another model. Workers do not commit: the master reviews the uncommitted diff and commits it, so every
commit has passed the master's review.

**Cost ceiling** (the owner's): every worker runs Claude Opus 5.5 at an effort of `high` or less; only the main session
runs at `xhigh`. Nothing above Claude Opus 5.5, no Claude Fable, no `max`, no fast mode.

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
- A worker whose checks fail gets its report back once, with the errors; a builder that ran at `medium` is spawned
  again at `high` instead ([Choosing the effort](#choosing-the-effort)). After a second failure the master finishes
  the work itself.

**A work packet holds:**

- the goal;
- the decisions and docs it implements;
- scope, in and out;
- the claims: the narrowest paths it may change, and `@dev-stack` when it runs the stack;
- done-when: tests, `pnpm verify`, docs;
- constraints;
- the worktree, and the worker with its effort;
- the report to return: what changed, check output, deviations, open questions.

### Choosing the effort

The model is fixed, so effort is the lever (the owner, 2026-10-23). Effort sets how much work an agent does: how many
files it reads, how much it runs and checks. More effort buys fewer missed edge cases, not a better approach.

| Work | Effort |
| --- | --- |
| Searching; reading CI logs, test output and long files (`scout`) | `low` |
| A mechanical change (`chore`) | `medium` |
| A precise pull request: the packet names the files and the change, or holds the code to write (`builder`) | `medium` |
| A pull request that needs judgment: parts that must fit together, debugging, security, identity, the Game Contract (`builder`) | `high` |
| A review (`reviewer`) | `high` |
| The master's routine turns: plan notes, opening a pull request | `high` |
| The master's plans, ADRs, work packets for hard pull requests, and its review of every diff | `xhigh` |

- **Name the model and the effort every time a worker is spawned.** A subagent with no effort of its own, such as the
  built-in `Explore` or `general-purpose`, or a worker spawned before its definition has loaded, runs at the session's
  effort: the master's `xhigh`, which the ceiling keeps for the master. Search with `scout`, not `Explore`.
- **Reading goes to the scout.** It reads the CI log, the test output or the long file and returns what matters. The
  master reads the summary, so its own context stays small; every master turn re-reads that context.
- **Checkable work runs at `medium` first; a failure runs again at `high`.** A builder that ran at `medium` and whose
  checks fail is spawned again at `high` in the same worktree, with its report and the errors. A resumed worker keeps the
  effort it was spawned with, so a resume is not a step up. In Anthropic's runs of SWE-bench Pro on Opus 5.5, running
  everything at `low` and re-running the failures at `high` solved about 97% for about $0.17 a task, against 95.3% for
  $0.29 running everything at `high`. This repository starts at `medium`, not `low`, because a failed round here also
  costs a review by the master.
- **Price a finished pull request, not a token.** A cheaper run that needs another round costs a second worker run and a
  second review by the master. The same runs back the rule that every worker runs Opus: Opus 5.5 at `medium` solved
  92.8% at $0.22 per solved task, and Sonnet 5 solved 77.4% at $0.84.
- **The owner sets the master's effort** with `/effort`. Changing the effort keeps the prompt cache, but changing the
  model rebuilds it, so the master does not change model during a session.
- **Measure.** Each pull request description names every worker that ran, at which effort, and how many rounds it took.
  `/usage` shows each subagent's share of usage. Change this table when those numbers say so.

Sources: Anthropic,
[Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)
and [Effort](https://platform.claude.com/docs/en/build-with-claude/effort); Claude Code,
[Subagents](https://code.claude.com/docs/en/sub-agents) and [Model configuration](https://code.claude.com/docs/en/model-config);
the model selection section of the
[subagent-driven-development](https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md)
skill in obra/superpowers. The figures are Anthropic's, at list prices, as of October 2026: they show a direction, not
what this repository will see.

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
3. The worker's hooks keep it inside its claims. An edit outside them, in another worktree or in the main checkout is
   blocked, and so are the commands a worker may not run: commit, push, `gh pr`, `kubectl`, deploys, the UAT and
   production hosts. The hooks match what the worker writes, so they prevent accidents; they are not a security
   boundary.
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
