---
title: "0056: Make the agent workflow tool-neutral, and put the gates in the repository"
description: The rules live in docs and in checks, not in one tool's hooks. Claude Code and opencode are adapters; the owner names the model, and a fresh-context reviewer plus the owner's review compensate for one model reviewing itself.
sidebar:
  order: 56
---

- **Status:** Accepted
- **Date:** 2026-10-31
- **Decided by:** the owner, 2026-10-31, locking the ten rules of the plan space `plans/agent-workflow` ("chốt nha").

## Context

The repository has been built by Claude Code sessions. `docs/guides/working-with-agents.md` named Claude Opus 5.5 for
the master and every worker, and the claims guard lived in `.claude/agents/*.md` hooks. That held while one tool ran
every session. The owner now runs sessions in opencode, with DeepSeek V4.1 Flash, and wants the same rules and the
same review rather than a second process.

Two facts force the decision:

- opencode does not read `.claude/agents` or its hooks. It has its own agents and permissions under `.opencode/`, and
  other tools will keep appearing.
- The reviewer runs the same model as the master. A same-model review is weaker than an independent one, so the
  process must not pretend otherwise.

## Decision

- **The workflow is tool-neutral.** [`docs/guides/opencode-workflow.md`](../guides/opencode-workflow.md) holds the
  loop: risk tiers T1–T3, research R0–R3, the work packet, gates V0–V4, the review checklist, the stop rules, the
  definition of junk, the size target, the deploy rules and the metrics.
  [`docs/guides/working-with-agents.md`](../guides/working-with-agents.md) keeps the roles, the claims and the
  environment. Tool configuration is an adapter: `.claude/` for Claude Code, `.opencode/` for opencode. If an adapter
  and the docs disagree, the docs win.
- **The owner chooses the model for a session.** No single model is pinned for the repository: each adapter says what
  its workers run. opencode inherits the session's model; `.claude/` keeps its definitions, because L-01 leaves it as
  it is. The old Claude Opus 5.5 ceiling is removed. Each pull request names the model, the workers and the rounds.
- **Review compensates for one model.** The master reviews its own diff cold; a fresh-context reviewer gets the diff,
  the spec and the checklist, not the master's reasoning; the owner reads the diff of a T3 change. The six metrics
  watch what escapes.
- **The gates belong to the repository**, not to a tool: `pnpm verify`, conformance, the docs build,
  `pnpm claims check`, CI, and `pnpm release:check` / `check:uat` / `check:prod`. A docs-only change uses the docs
  build and its link check — the scope CI runs for it — and does not run the API suite.
- **Merge, tag and deploy remain the owner's word**: "merge", "deploy", "lên prod". opencode asks before those
  commands; it does not grant them.
- **Both adapters stay.** `.claude/` remains for Claude Code sessions; `.opencode/` is added for opencode. The claims
  tool is shared. opencode has no hook yet, so the master runs `pnpm claims open/check/close` by hand until a pilot
  shows a plugin is needed.

## Consequences

- The model table, the effort table and the `xhigh` ceiling leave `working-with-agents.md`; the page keeps the roles,
  the packet, the claims and the environment. `.claude/agents/` keep their model lines; changing them is a separate
  decision.
- `AGENTS.md` points at both pages; a session reads them before it changes anything.
- opencode's permissions and policies are guardrails, not a sandbox: shell runs with the user's authority. The
  guarantee is the small diff, the checks and the owner's review.
- The claims guard in Claude Code's hooks and the manual `pnpm claims` in opencode are the same rule, enforced to
  different depths. A plugin for opencode is deferred until the pilot evidence says it is worth it.
- Every ten pull requests the six metrics are read; a rule changes in its own pull request with the number that
  caused it.
- `pnpm verify` is no longer required for a docs-only change; the Definition of Done now says what CI actually runs
  for that scope.

## Alternatives considered

- **Keep the Claude-only rules.** A different tool cannot comply; sessions drift to their own process, which is the
  problem this ADR fixes.
- **Give opencode its own rules.** Two specs, one repository; they diverge on the first disagreement.
- **Pin one model in the repository.** The model is the owner's choice per session; the gates, not the name, decide
  whether the work is done. Pinning also ages badly, as the old table shows.
- **Build the claims plugin now.** It is code that needs its own tests and review. The pilot comes first: if the
  manual claims check misses something, the plugin earns its place.
- **Keep `pnpm verify` for docs-only changes.** It runs the API suite for a page of prose, and on a machine with a low
  inotify limit it fails for a reason unrelated to the change. CI already scopes docs to Biome and the docs build;
  the Definition of Done now says the same.
