---
title: "0013: Light and dark themes from shared design tokens"
description: One role-named palette in light and dark for the hub, the site and the game kit; the device's choice in a cookie; games opt in.
sidebar:
  order: 13
---

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

The owner asked for a serious light/dark mode on the landing page, the hub and some games, without forcing it on
every future game: some games have one look by nature. Colours were hard-coded everywhere (about 130 Tailwind
palette classes in the hub alone), so dark mode added with `dark:` variants would miss elements and drift over
time. Some light colours also failed WCAG AA: white text on the `#f97316` buttons is 2.8:1.

## Decision

- **One palette, two themes.** `packages/design-tokens/tokens.css` defines tokens named by role (`page`,
  `surface`, `ink`, `ink-soft`, `brand`, `danger`…) for light, the default, and dark (`data-theme="dark"` on
  `<html>`). The dark palette is warm charcoal, not black or navy, so Tò He keeps its toy-like warmth. UI code uses
  token colours only: the hub removes Tailwind's default palette, and a test rejects raw palette classes.
- **Contrast is tested, not reviewed.**
  - A unit test checks that the token pairs meet WCAG AA in both themes.
  - The e2e smoke test runs axe-core's contrast check on every hub screen in both themes.
  - White on `brand` passes only as large text, so text on `brand` is at least 1.25rem bold.
- **The choice: system, light or dark, per device, default system.**
  - It is stored in the `tohe-theme` cookie; no cookie means system. Cookies are shared by every port of a
    host, so the site follows the same choice as the hub.
  - "System" follows the device live.
  - A blocking same-origin script applies the choice before the first paint, so a dark screen never flashes
    white at night. The browser's UI colour (`theme-color`) follows the theme.
- **Games opt in.**
  - `game.json` gains `themes`: `["light"]` (the default), `["dark"]`, or both.
  - The protocol's `settings` gains `theme`, the theme the hub is showing, sent at start and whenever it changes.
  - A game with one look keeps it; the hub's frame around the game follows the hub.
  - Old game builds ignore the new field, because the game-side SDK does not validate settings.
  - The contract change ships with its docs and conformance checks in both themes, in the same PR.

## Consequences

- Dark mode is a token change, not a component change: screens built from tokens get it for free.
- The light theme shifts slightly where contrast required it:
  - primary buttons are `#ea580c` (was `#f97316`), with labels of 1.25rem;
  - secondary text is a solid `ink-soft` instead of translucent brown.
- The choice belongs to the device, not to a profile. A theme per profile would need settings stored on the server
  (with M2).
- The cookie reaches everything on the host, including the games origin, which ignores it. If production ever puts
  the hub and the site on separate subdomains, the cookie needs a `Domain` attribute.

## Alternatives considered

- **`dark:` variants on every element:** easy to miss elements, doubles every class list, and leaves no single
  place to tune contrast.
- **A theme per profile:** would let kids sharing a device choose differently, but needs server-side settings first
  (M2).
- **localStorage instead of a cookie:** not shared between origins, so the site and the hub could disagree.
- **A neutral or navy dark palette:** the familiar default, but it loses the warm Tò He identity.
