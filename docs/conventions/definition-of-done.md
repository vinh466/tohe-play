---
title: Definition of Done
description: The checklist every change must meet before it is merged.
sidebar:
  order: 1
---

A change is done when **all** of these are true:

- [ ] `pnpm verify` passes locally (Biome, typecheck, unit + API tests, build, conformance).
- [ ] New behaviour has tests at the lowest sensible level: pure logic in Vitest, endpoints in xUnit against
      PostgreSQL, games in conformance, user journeys in the e2e smoke test.
- [ ] Generated files are regenerated and committed (OpenAPI, API types, JSON Schemas); `git status` is clean after
      `pnpm build`.
- [ ] Docs describing the changed behaviour are updated in the same PR; links still resolve (the docs build
      validates them).
- [ ] An ADR exists for any decision that is expensive to reverse.
- [ ] For games: `SPEC.md` matches the game, the conformance screenshot was looked at, and it was played on a
      phone-sized viewport. Its public page (`/games/<id>/`) comes from `game.json` and its icon by itself: the
      `description` is written for a stranger, the how-to is added to `apps/web/src/content/games.ts` (a test fails
      without it), `pnpm --filter @tohe/routes build` regenerated the sitemap, and the page was looked at
      (`pnpm --filter @tohe/web build`).
- [ ] For hub changes: the e2e smoke test passes against `pnpm dev` or `docker compose up`.
- [ ] No secrets, no personal data, no new third-party network calls.
- [ ] CI is green on the pull request.
