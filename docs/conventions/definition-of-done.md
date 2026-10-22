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
      phone-sized viewport. Its public pages (`/games/<id>/`, `/en/games/<id>/`) are part of it: the
      descriptions in `game.json` are written for a stranger, `page/vi.md`, `page/en.md` and `page/facts.json` are
      written and true (the build fails without them), its preview pictures were drawn by
      `pnpm --filter @tohe/web generate:og`, looked at and committed (`page/og.*.png`, `page/og.json`),
      `pnpm --filter @tohe/routes build` regenerated the sitemap, and the pages were looked at
      (`pnpm --filter @tohe/web build`).
- [ ] For hub changes: the e2e smoke test passes against `pnpm dev` or `docker compose up`.
- [ ] For a change to a screen, a string or a picture of the hub, the public pages or a game's page: the checklist of
      [Voice and look](voice-and-look.md#checklist-every-screen-every-pull-request-that-changes-one) passes — no emoji as
      an icon, one title, no stack of identical white cards, no cut words, a name that matches its avatar, light and dark at
      360 px, on a tablet, on a computer and on a phone held sideways, targets of 44 px with labels, copy that passes the
      Voice table, nothing internal shown, child or parent clear, read out loud. Screenshots of the screens it changed are
      looked at, light and dark.
- [ ] No secrets, no personal data, no new third-party network calls.
- [ ] CI is green on the pull request.
