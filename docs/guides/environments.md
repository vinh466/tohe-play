---
title: Environments and releases
description: How a change travels from an idea through development, CI and UAT to production — by tag, one build, with the owner deciding when.
sidebar:
  order: 4
---

A change travels one road: a branch, a pull request, `main`, UAT, production. The images are built once, for the commit
on `main`; UAT and production run those same images, and a tag says which commit each one runs
([ADR 0041](../decisions/0041-promote-one-build-through-the-environments-by-tag.md)). The owner decides when; the agent
does the steps.

## The four environments

| | Development | CI | UAT | Production |
| --- | --- | --- | --- | --- |
| For | Building and trying | The automatic gate | The family's daily use, and where the images bound for production run first | The public |
| Where | The developer's machine: `pnpm dev` or compose project `tohe`, ports 47xx | GitHub Actions: the pull request, then `main` | The homelab, `10.100.0.2`: hub `http://10.100.0.2:4820`, site `:4810`, games `:4830`, compose project `tohe-uat` | Hub `https://toheplay.io.vn` (API at `/api`, console at `/admin/`), games `https://games.toheplay.io.vn`, docs and site `https://docs.toheplay.io.vn` ([ADR 0040](../decisions/0040-all-of-tohe-on-one-domain-of-its-own.md)) |
| Runs | The working tree | The checks, then the images and the chart | The images of the newest `uat-` tag | The images of the newest `prod-` tag |
| Data | Throwaway | Throwaway | Real, the family's | Real once people other than the owner use it |
| Config lives in | `compose.yaml` | `.github/workflows/ci.yml` | `compose.uat.yaml` and `~/.config/tohe-uat/uat.env` on the homelab | The `apps/tohe` component of the `platform-infra` repository (Argo CD), secrets in Infisical `/tohe` |
| An agent may | Anything | — | Tag and deploy when the owner says "deploy"; read logs | Read from outside; tag and promote when the owner says "lên prod" |

What each image reads is in [Configuration](configuration.md); how UAT is run in [UAT environment](uat.md); the chart
production uses in [Self-hosting](self-hosting.md) ([ADR 0021](../decisions/0021-release-production-through-the-tohe-chart.md),
[ADR 0010](../decisions/0010-environments-dev-and-uat.md)).

## From idea to production

```mermaid
flowchart TD
  idea([Idea]) --> big{Bigger change?}
  big -- yes --> plan[Think it through and plan it with the owner]
  plan --> spec[Spec or ADR in docs]
  big -- no --> branch
  spec --> branch[Branch and worktree]
  branch --> pr[Pull request and pnpm verify]
  pr --> ci[CI: verify, chart, stack]
  ci --> merge{Owner says merge}
  merge --> main[main: CI builds images and chart once]
  main --> deploy{Owner says deploy}
  deploy --> uat[Tag uat-YYYY-MM-DD.N]
  uat --> script[deploy/uat/deploy.sh with the tag]
  script --> uatcheck[Checks on UAT]
  uatcheck --> use[Family and owner use it]
  use --> prod{Owner says lên prod}
  prod --> ptag[Tag prod-YYYY-MM-DD.N]
  ptag --> release[GitHub Release with notes]
  release --> infra[platform-infra pull request: targetRevision only, merged by the agent]
  infra --> argo[Argo CD syncs]
  argo --> prodcheck[Checks on production]
```

Nothing is built after `main`. A fix in a hurry takes the same road with less time on UAT; nothing is patched on
production directly.

## The owner's three words

| The owner says | The agent does |
| --- | --- |
| "merge" | Merges the pull request the owner reviewed, with a merge commit, once its checks are green. CI then builds and publishes the images for the new commit on `main`. Nothing is merged without the owner's word. |
| "deploy" | Tags the commit `uat-…` (the newest commit of `main` unless told otherwise), pushes the tag, runs `deploy/uat/deploy.sh <tag>` and runs the [checks](#checks-after-a-deploy). Reports the result. |
| "lên prod" (or the owner tags `prod-…` themselves) | Takes the commit of the newest `uat-` tag unless the owner names another, checks that it carries a `uat-` tag, tags it `prod-…`, publishes a GitHub Release, opens the `platform-infra` pull request that changes only `targetRevision` of `apps/tohe`, merges it, waits for Argo CD, and runs the [checks](#checks-after-a-deploy). Reports the result. If a `prod-` tag the owner made points at a commit without a `uat-` tag, stops and asks. |

Any other change to `platform-infra` stays a pull request the owner merges.

## Tags

Annotated tags on commits of `main`: `uat-YYYY-MM-DD.N` and `prod-YYYY-MM-DD.N`, where the date is in Việt Nam time and
`N` counts the tags of that day from 1. A tag is never moved or deleted — except a `prod-` tag that was never promoted,
on the owner's word. The newest tag of a prefix (latest date, then highest `N`: `git tag -l 'uat-*' --sort=-v:refname`)
is what that environment runs. Rolling back is a new tag on an older commit ([below](#rolling-back)).

Rules before tagging:

| Rule | Check |
| --- | --- |
| The commit is on `main` | `git merge-base --is-ancestor <commit> origin/main` |
| CI is green for it | `gh run list --commit <sha>` |
| Its images exist | `docker manifest inspect ghcr.io/vinh466/tohe-play/api:sha-<commit>` |
| A `prod-` tag goes only on a commit that has a `uat-` tag | `git tag --points-at <commit> --list 'uat-*'` |

```sh
git tag -a uat-2026-10-21.1 <commit> -m "UAT 2026-10-21.1"
git push origin uat-2026-10-21.1
deploy/uat/deploy.sh uat-2026-10-21.1

git tag -a prod-2026-10-23.1 <commit> -m "Production 2026-10-23.1"
git push origin prod-2026-10-23.1
gh release create prod-2026-10-23.1 --generate-notes --notes-start-tag <previous prod- tag>   # the first time: no start tag
```

The release notes come from the pull requests since the previous `prod-` tag, so pull request titles matter.
`git tag -l 'prod-*'` and the GitHub Releases list what production ran and when. A GitHub tag ruleset on `uat-*` and
`prod-*` (no update, no deletion) stops a tag from being moved by mistake; the owner can add it in the repository's
settings.

What CI publishes for each commit on `main`: the images `ghcr.io/vinh466/tohe-play/<api|hub|games|site>:sha-<full commit>`
and the chart `oci://ghcr.io/vinh466/charts/tohe` at version `<Chart.yaml version>-g<7-char sha>`. The `targetRevision`
in `platform-infra` is that chart version.

## Checks after a deploy

By hand, until a script exists.

UAT:

- `curl -s http://10.100.0.2:4820/api/config`: `apiVersion` is the first 12 characters of the tag's commit
  (`git rev-parse --short=12 <tag>^{commit}`).
- `curl -s http://10.100.0.2:4820/api/health` answers healthy.
- `docker compose -p tohe-uat logs api` shows no errors, and the migrations were applied at start.
- The games origin (`http://10.100.0.2:4830/`) redirects to the hub.

Production:

- `curl -s https://toheplay.io.vn/api/config`: `apiVersion` is `sha-<full commit>` of the tag.
- `curl -s https://toheplay.io.vn/api/health` answers healthy.
- The games origin and the docs answer.
- The CSP and HSTS headers are present.

If a check fails, say so and stop. Rolling back is the owner's call ([below](#rolling-back)).

## Testing, layer by layer

| Layer | What | Runs |
| --- | --- | --- |
| Unit | Vitest: the game logic, the SDK, the hub | `pnpm test`, in `pnpm verify` and CI ([what runs when](#continuous-integration)) |
| API | xUnit against PostgreSQL through Testcontainers, never a shared database | `pnpm test`, in `pnpm verify` and CI (needs Docker) |
| Games | The conformance kit: the Game Contract, the CSP, both themes | `pnpm conformance`, in `pnpm verify` and CI |
| The stack | The e2e smoke test, `routes` (the hub serves the map of its paths, [ADR 0042](../decisions/0042-hosts-by-trust-paths-by-component.md)), and `rooms`: three phones play a Tiến Lên table ([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md)) | CI against the compose stack; locally `pnpm --filter @tohe/e2e smoke` and `rooms` against a running stack |
| The chart | Lint, every profile rendered, every guard, an install and an upgrade on kind, `helm test` | CI, job `chart`; locally `deploy/helm/tohe/ci/check.sh` for the first part |
| After a deploy | The [checks](#checks-after-a-deploy) above | By hand, on UAT and production |
| Real devices | Phones: touch, sound, install, the installed PWA | The owner; [below](#local-development) for how to get a build on a phone |

[Definition of Done](../conventions/definition-of-done.md) says what a pull request needs before it is finished.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and every push to `main`. A first job, *What the change touches*
(`scripts/ci-scope.sh`), sorts a pull request by the files it changed since it left its base:

| Scope | The pull request changes only | What runs |
| --- | --- | --- |
| `notes` | plan notes (`plans/`), agent and skill definitions (`.claude/`), `AGENTS.md`, `CLAUDE.md`, `README.md` | nothing: none of it is built or shipped |
| `docs` | the above and the spec under `docs/` | Biome, and the site's build, which checks every internal link |
| `all` | anything else | every job: verify, chart, stack |

- A push to `main` is always `all`, and its `pnpm verify` runs every task without reading a cache
  (`--cache=local:w`): what gets published has passed every check from scratch.
- On a pull request, `pnpm verify` reads the Turborepo cache the base branch saved: a task whose inputs did not change
  replays its result. A task's inputs are declared in `turbo.json`; a file a task reads from outside its package (as the
  site reads `docs/`) must be listed there, or a change to it will not rebuild the task. Turborepo's `--affected` is not
  used for the same reason: it looks only at which package folders changed.
- Verify, chart and stack run side by side; publish waits for all three, on `main` only.

## Local development

Detail is in [Local development](local-development.md). In short:

- **Mode A**, `pnpm dev`: hot reload for the API, the games origin, the hub and the site; PostgreSQL and Mailpit from
  compose.
- **Mode B**, `docker compose up --build -d`: the production-like containers. Do not run both at once; they share ports.
- **Phones on the LAN**: `TOHE_PUBLIC_HOST=<lan address>` with Mode B. Plain HTTP, so no service worker and no install.
- **An Android phone over USB**: forward the hub and the games origin, `adb reverse tcp:4720 tcp:4720` and
  `adb reverse tcp:4730 tcp:4730`, then open `http://localhost:4720`. `localhost` is a secure context, so the service
  worker runs and Chrome can offer to install the app.
- **An iPhone**: try it on production while only the owner uses it.
- **One dev stack runs per machine at a time.** Parallel work (several branches or worktrees) relies on `pnpm verify`,
  whose API tests use their own Testcontainers, and on CI.

## Data and migrations

- Development and CI data is throwaway. UAT holds the family's data; production runs the same migrations on its own
  database.
- A migration is final once it is merged to `main`: it is never edited again, and a correction is a new migration. Until
  then, the pull request that adds it may still change it.
- A column is dropped or renamed one release after the code stops using it, so the previous tag still runs.
- Never run migrations against UAT or production by hand: the API applies them when it starts, and a UAT deploy backs
  the database up first.
- No data leaves UAT or production for a development machine, except a UAT dump used to dry-run a migration and deleted
  afterwards.
- Changing the product's behaviour freely, removing a feature without a compatibility window, stays allowed while
  production is the owner's test bed.

## Rolling back

- **UAT**: a new `uat-` tag on the older commit, deployed with `deploy/uat/deploy.sh <new tag>`; the old tags stay. The
  database is not rolled back with the code: that is why a migration waits one release before it removes anything. A
  backup from before the deploy is in `~/backups/tohe-uat/` ([UAT](uat.md#backups)).
- **Production**: a new `prod-` tag on an older commit that has a `uat-` tag, promoted the same way (release,
  `platform-infra` pull request, Argo CD). The old tag stays.
