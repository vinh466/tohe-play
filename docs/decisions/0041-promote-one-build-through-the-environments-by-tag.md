---
title: "0041: Promote one build through the environments by tag"
description: main is the only long-lived branch and every commit on it is built once; a uat- tag puts a commit on UAT, a prod- tag puts the same images on production, and production only runs a commit that ran on UAT. The owner decides when; the agent does the rest.
sidebar:
  order: 41
---

- **Status:** Accepted
- **Date:** 2026-10-19
- **Amends:** [ADR 0010](0010-environments-dev-and-uat.md) — UAT deploys the commit of a `uat-` tag rather than
  `origin/main`, and is where the images bound for production run first;
  [ADR 0021](0021-release-production-through-the-tohe-chart.md) §5 — the promotion pull request against `platform-infra`
  follows a `prod-` tag, and the agent opens and merges it

## Context

Production has run on `toheplay.io.vn` since 2026-10-19 (ADR 0040). The way a change reaches it works, but it is spread
over ADR 0009 (development), ADR 0010 (UAT), ADR 0021 (production through the chart), the UAT and self-hosting guides,
the CI workflow and the agents' notes. Three things were never written down:

- **What runs where.** UAT and production report their commit in `GET /api/config`, but nothing records which release
  that was, or lets anyone check that production runs what UAT ran.
- **What an agent may do with production.** `AGENTS.md` has rules for UAT and none for production.
- **How migrations change** once two environments hold data: UAT holds the family's, and production runs the same
  migrations.

The owner decided (2026-10-19): `main` is the only long-lived branch; production runs only a commit that
ran on UAT; a release to production is a `prod-` tag; the environments are told apart by tags; behind a tag the agent
does the mechanical steps by hand — deploying UAT, opening and merging the pull request against `platform-infra` — until
a workflow takes them over; a migration is final once made; while production is the owner's test bed, the product's
behaviour may change freely.

## Decision

1. **Four environments, one role each.**

   | | Development | CI | UAT | Production |
   |---|---|---|---|---|
   | For | building and trying | the automatic gate | the family's daily use, and the place where the images bound for production run first | the public |
   | Runs | the working tree | the pull request, then `main` | the images of the newest `uat-` tag | the images of the newest `prod-` tag |
   | Data | throwaway | throwaway | real, the family's | real once people other than the owner use it |
   | An agent may | anything | — | tag and deploy when the owner says "deploy"; read logs | read from outside; tag and promote when the owner says "lên prod" |

2. **One branch, one build.** `main` is the only long-lived branch; every change is a short-lived branch and a pull
   request. CI builds the images (`sha-<commit>`) and the chart (`<version>-g<short sha>`) once for each commit on `main`
   (ADR 0021). No environment builds anything — except UAT rolled back to a commit from before CI published images,
   which `deploy/uat/deploy.sh` builds as it used to — and no environment has a branch of its own.

3. **Tags mark the environments.** Annotated tags on commits of `main`: `uat-YYYY-MM-DD.N` and `prod-YYYY-MM-DD.N`. A tag
   is never moved or deleted. The newest tag of a prefix — the latest date, then the highest `N`, dates in Việt Nam time
   — is what that environment runs; rolling back is a new tag on an older commit, deployed or promoted like any other.

4. **Production runs only a commit that ran on UAT** — the same images. A fix in a hurry takes the same road with less
   time on UAT; nothing is patched on production directly.

5. **The owner decides when; the agent does the rest.**
   - "merge": the agent merges the pull request the owner reviewed, with a merge commit, once its checks are green.
   - "deploy": the agent tags the commit `uat-…` (the newest commit of `main` unless the owner names another), runs
     `deploy/uat/deploy.sh <tag>` and checks UAT.
   - "lên prod", or the owner tagging `prod-…`: for the commit of the newest `uat-` tag unless the owner names another,
     the agent checks that the commit carries a `uat-` tag, tags it, publishes a GitHub Release with notes generated
     from the pull requests since the previous `prod-` tag, opens the pull request against `platform-infra` that changes
     only `targetRevision` of `apps/tohe`, merges it, and checks production once Argo CD has synced.
   - If a `prod-` tag the owner made points at a commit without a `uat-` tag, the agent stops and asks; a `prod-` tag
     that was never promoted is the one tag that may be deleted, on the owner's word.
   - Any other change to `platform-infra` stays a pull request the owner merges. A workflow may take over the agent's
     steps later without changing this decision.

6. **Agents and production.** Agents read production from outside only and never write to its cluster. No data leaves
   UAT or production for a development machine, except a UAT dump used to dry-run a migration and deleted afterwards.

7. **Migrations only move forward.** A migration is final once it is merged to `main`: it is never edited again, and a
   correction is a new migration. Until then, the pull request that adds it may still change it.
   A column is dropped or renamed one release after the code stops using it, so the previous tag still runs. Changing the
   product's behaviour freely — removing a feature without a compatibility window — remains allowed while production is
   the owner's test bed, as the owner put it when production opened.

Not decided here: a workflow that acts on tags, a staging environment apart from UAT, preview environments for pull
requests, feature flags beyond the console's run-time settings (ADR 0028).

## Consequences

- [Environments](../guides/environments.md) describes the flow in one place; the UAT, local development and self-hosting
  guides point to it. `AGENTS.md` gains a rule for production.
- `git tag -l 'prod-*'` and the GitHub Releases list what production ran and when; the release notes come from the pull
  requests, so pull request titles matter.
- Until scripts for it exist, the checks after a deploy are run by hand, as listed in the guide.
- Tags must be pushed (`git push origin <tag>`). Protecting `uat-*` and `prod-*` with a GitHub tag ruleset would stop a
  tag from being moved or deleted by mistake.
- Merging a promotion pull request in `platform-infra` is a power the agent now has for that one kind of change; the
  owner keeps the decision through the tag.

## Alternatives considered

- **A branch per environment** (`uat`, `production`). Promotion stops being a copy of one built artifact and becomes a
  merge that can carry more than intended; the branches drift. The usual advice for GitOps is the opposite.
- **Semantic versions for releases** (`v1.4.0`). Nothing outside Tò He depends on its API version, and a date says when a
  release happened. Games keep semantic versions under the Game Contract (ADR 0007).
- **A workflow on the tag now**, opening the `platform-infra` pull request with a token. It needs a credential across
  repositories; the owner chose the manual bridge until the flow has settled.
- **Argo CD following a version range**, so the tag alone deploys. The chart's versions are pre-releases (`-g<sha>`), which
  ranges do not match without renumbering, and `platform-infra` would lose its record of what was promoted.
- **Skipping UAT for urgent fixes.** Production would run images nobody tried; the same images on both is the point.
