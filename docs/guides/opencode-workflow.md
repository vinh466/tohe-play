---
title: How work runs
description: The loop, the risk tiers, the research depth, the gates, the review and the stop rules every agent follows in this repository, whichever tool it runs in.
sidebar:
  order: 3.5
---

This page is the workflow. [Working with agents](working-with-agents.md) names the roles, the claims and the
environment; [Definition of Done](../conventions/definition-of-done.md) is the checklist every change must meet. If a
tool's configuration and this page disagree, this page wins and the configuration is a bug
([ADR 0056](../decisions/0056-make-the-agent-workflow-tool-neutral.md)).

## The loop

```text
sync → classify → research → spec/packet → build → verify → review → pull request → merge → release → log
```

Each step leaves something the owner can read: a plan, a work packet, a pull request, a release note.

## Risk tiers

| Tier | Examples | Who approves the design |
| --- | --- | --- |
| **T1** | a clear bug, copy, docs, a small screen, a chore | the master; the owner reviews the diff |
| **T2** | a feature in one package, an endpoint, a screen, a game | the owner reads the packet before the build |
| **T3** | the Game Contract, identity or sign-in, security, a schema or migration, a new origin, service, dependency or environment variable, a refactor across packages, release tooling | the owner before any code; an ADR if the choice is expensive to reverse |

When in doubt, take the higher tier. A change that starts as T1 and grows past its packet stops and becomes T2.

## Model

The owner chooses the model for a session. `.opencode/agents/` inherit it; `.claude/agents/` name their own and are
left as they are (`.claude/` is out of scope for the opencode move). Each pull request names the model, the workers
that ran and the rounds it took. The model is not the guardrail — the gates are. A reviewer that runs the same model
as the master is a known limit; [Review](#review-when-one-model-writes) says how it is compensated.

## Research depth

| Depth | When | What it leaves |
| --- | --- | --- |
| **R0** | a typo, copy, a bug whose cause is known | nothing |
| **R1** | a bug or a feature inside the repository | three lines in the packet: what is known, what is missing |
| **R2** | T3, a new dependency, the contract, security, a new UX | `plans/<plan>/research/R-NN.md`: the question, facts with source + date + version, options, a recommendation, and what would change my mind |
| **R3** | it is not known whether the idea works | a spike in a worktree, time-boxed to one session; keep the note, drop the code |

An R2 note keeps facts and assumptions apart. Every option names its cost, licence, maintenance and risk. "It feels
better" is not evidence.

## Ready, and the work packet

Work starts when its packet answers:

- the goal, in one sentence, and why now;
- the docs, ADR or plan item it implements — or the note that writes it first;
- what is in scope and what is not;
- done-when: the tests, commands and pictures that will show it works;
- the claims: the narrowest paths it may change;
- the gates from [Gates](#gates), and the rollback for T2 and T3;
- the open questions, answered or explicitly deferred.

For T1 the packet is the pull request description. For T2 and T3 it is a plan item. No packet, no worktree.

## Size

A pull request aims at one purpose, at most 12 files and 400 changed lines, excluding generated files, the lockfile
and pictures. Past that, split it or say in the packet why it cannot be split. The number is a target; a justified
exception is fine, a habit is not.

## Gates

| Gate | What it runs | When |
| --- | --- | --- |
| **V0** | `pnpm exec biome check <paths>` | after every edit |
| **V1** | `pnpm exec turbo run typecheck test --filter=<package>` | while building, for the package touched |
| **V2** | `pnpm verify` — Biome, the games' assets, typecheck, test, build, conformance | before a pull request that touches code or a generated file |
| **V3** | the checks for the kind of change (below) | before the pull request, with V2 |
| **V4** | `pnpm release:check <ref> --for uat\|prod`, then `pnpm check:uat` or `pnpm check:prod` | before and after a release |

| Kind of change | V3, in addition |
| --- | --- |
| docs or plan only | `pnpm exec turbo run build --filter=@tohe/docs` — the build and its link check; V2 is not required |
| hub, web or Studio UI | the e2e smoke test; screenshots light and dark at 360 px, per [Voice and look](../conventions/voice-and-look.md) |
| API | the API tests on PostgreSQL; `git status` clean after the build (OpenAPI and types) |
| Game Contract | conformance for every game; schemas regenerated; the ADR and docs in the same pull request |
| a game | conformance, the screenshot looked at, `SPEC.md`, the public pages, OG images and the sitemap |
| assets | `pnpm assets:check`; the lock and `assets.gen.ts` regenerated |
| routes or infrastructure | `pnpm --filter @tohe/routes build`; the generated Caddy, robots and path files with no diff |
| a dependency | the [upgrade watchlist](../roadmap/upgrade-watchlist.md); the generated API types checked |

A pull request carries its evidence:

```text
## Checks
- pnpm verify — PASS (local, <time>)
- <V3> — PASS/FAIL + the log
## Docs
- docs/<page> — updated / no change because <reason>
## Workers
- <agent>, <model>, <rounds>
## Deviations
- <where it differs from the packet, and why> or "none"
```

## Review when one model writes

The master reviews its own diff first, cold: it reads the diff, not its memory of writing it.

Then a reviewer subagent gets the diff, the spec excerpt and the checklist — not the master's reasoning, so it is not
anchored by it. It reports findings by severity with `file:line`. "No findings" is allowed, but it must say what it
checked. A T3 change needs the owner's eyes on the diff before merge.

The checklist every diff answers:

- does the new behaviour have a test that fails without it?
- were generated files regenerated, not edited?
- do the docs describe what changed, in the same pull request?
- is there a secret, a debug log or personal data?
- is there dead code, a comment-out, an unused import or a TODO without a plan item?
- was a check weakened, or a warning silenced?
- did the change do something outside its packet?

Same model or not, this is a limit: a fresh context and a checklist catch less than a different reviewer would. Small
diffs, tests and the owner's review are the compensation. The [metrics](#metrics) watch what slips through.

## Stop rules

Stop and ask the owner — write what, why, two or three options and a recommendation — when:

1. the change touches the Game Contract, identity or sign-in, security, a schema or a migration;
2. it adds a dependency, a technology, an origin, a service or an environment variable;
3. it needs a destructive command, or a write to UAT or production outside the read-only checks and `studio.draft`;
4. the spec is ambiguous, or two pages disagree;
5. the same failure has been fixed twice and still fails;
6. the diff exceeds the [size target](#size);
7. a check would have to be weakened to pass;
8. a failure cannot be explained.

## What counts as junk

A pull request is junk if it has any of: dead code, commented-out code, unused imports or dependencies; a TODO or
FIXME that names no plan item or issue; a drive-by rename, reformat or refactor; a helper that duplicates one already
in the repository; a hand-edited generated file; a debug log, secret or personal data; docs that say one thing while
the code does another; a test that exists only to raise coverage.

## Spec and implementation

- The pull request has a `Docs:` line. "No docs change" also needs a reason.
- A behaviour change changes the page that describes it, in the same pull request; the docs build and its link check
  are the gate.
- An expensive-to-reverse decision gets an ADR, before the code or with it.
- After merge: a plan `log.md` entry of five lines at most; a backlog row moves to done if it has one.
- Every ten pull requests: a fifteen-minute audit, three pages against the code; open fixes for what drifted.

## A session

Start: `git fetch --prune`; `git status`; `pnpm claims status`; the active plan's newest `log.md` entry and its
`PLAN.md` → Next; the last pull request and its CI. If the baseline is red, say so before building on it.

Work: one branch or worktree per pull request; the main checkout stays clean; reading goes to the scout; the master
keeps the conclusions.

End: a log entry of five lines at most, one next item named, a clean main checkout. Half-finished work stays in its
worktree and is reported, not hidden in the checkout.

## Merge, release, deploy

Merge only when the owner says "merge". Tag `uat-…` only when the owner says "deploy"; tag `prod-…` only when the
owner says "lên prod", on a commit that already has a `uat-` tag. The steps are in
[Environments and releases](environments.md).

`pnpm release:check <ref> --for uat|prod` runs first; `pnpm check:uat` or `pnpm check:prod` runs after, and the counts
go in the report. Never run migrations by hand, `kubectl` or `helm` by hand, wipe a volume, or write to production —
the one exception is a draft through the Studio's `studio.draft` token. UAT holds the family's data.

## Enforcement in this repository

| Layer | Where | What it does | What it cannot do |
| --- | --- | --- | --- |
| The rules | this page, [Working with agents](working-with-agents.md), the [Definition of Done](../conventions/definition-of-done.md) | the source of truth | enforce itself |
| opencode | `.opencode/opencode.jsonc`, `.opencode/agents/` | deny dangerous commands, ask before merge, tag or deploy, keep worker roles read-only or inside their worktree | shell runs with the user's authority; patterns are guardrails, not a sandbox |
| Claude Code | `.claude/agents/`, its hooks | the same roles; the claims guard blocks edits outside the claims | the same limit |
| The repository | `pnpm verify`, conformance, CI, `pnpm claims check` | the evidence | only as good as the checks |

The claims tool is the same in both tools: the master opens a worktree's claims, runs the checks and closes them.
opencode has no hook for it yet; until the pilot says it needs one, the master runs `pnpm claims open/check/close` by
hand ([ADR 0056](../decisions/0056-make-the-agent-workflow-tool-neutral.md)).

## Metrics

| Metric | Target | From |
| --- | --- | --- |
| Review rounds per pull request | at most one large rework | the pull request |
| Failures only on CI | 0, except infrastructure | the local gate against CI |
| Defects found after merge, per ten pull requests | 0 | issues and incidents |
| Pull request size | median at most 8 files and 250 lines; the cap is 12 and 400 | `gh pr view` |
| Docs drift, per ten pull requests | 0 | the `Docs:` line and the audit |
| Stop-rule violations | 0 | self-reported |

Every ten pull requests the numbers are read and the rules change in their own pull request, with the number that
caused it. No silent edits.

## Changing these rules

A rule changes like any other spec: a pull request that says what failed, what changes, and which check or metric will
show it worked. If a tool's configuration and this page disagree, fix the configuration, not the page.
