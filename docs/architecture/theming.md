---
title: Theming (light and dark)
description: How colours work in Tò He — design tokens, the player's light/dark choice, and the rules for UI code.
---

Decision and reasons: [ADR 0013](../decisions/0013-light-and-dark-themes.md).

## Design tokens

`packages/design-tokens/tokens.css` is the only source of colours. Each token is named by its role, with a light
value (the default) and a dark value (`data-theme="dark"` on `<html>`):

| Token | Role |
| --- | --- |
| `page` | Page background, sheets |
| `surface` | Cards, inputs, keypad keys, chips: anything raised |
| `fill` | Quiet rows and boxes inside a surface |
| `soft`, `soft-strong` | Tinted controls (secondary and icon buttons); pressed or selected tint |
| `line`, `line-strong` | Borders and dividers; dashed "add" outlines |
| `ink` | Main text |
| `ink-soft` | Secondary text: subtitles, hints, descriptions |
| `ink-faint` | Decoration only, never information (placeholders) |
| `accent` | Text and icons of secondary controls |
| `brand-ink` | Brand-coloured text: titles, links |
| `brand`, `brand-strong`, `on-brand` | Primary actions, their pressed state, and their text |
| `glow` | Coloured shadow under brand elements |
| `focus` | Keyboard focus ring |
| `danger`, `danger-soft`, `danger-soft-strong`, `danger-line` | Errors and destructive actions |
| `notice`, `notice-ink` | Informational banners (guest mode, offline) |
| `scrim` | Behind dialogs |
| `avatar-from`, `avatar-to` | Backdrop of emoji avatars |
| `bar` | Browser UI colour (`theme-color`) |

## Rules for UI code

- **Hub:** use the Tailwind classes generated from the tokens, for example `bg-page`, `bg-surface`, `text-ink`,
  `text-ink-soft`, `border-line`, `bg-brand text-on-brand`. Tailwind's default palette is removed, so a class like
  `bg-orange-500` generates nothing, and `src/tokens.test.ts` fails on it.
- **Text on `brand`** is at least `text-xl font-bold`: white on orange meets WCAG AA only as large text.
- **Selected state:** `bg-soft-strong` with a `ring-brand` ring (avatars, age bands, theme choices).
- **A new token** goes into both theme blocks, since a test checks that both define the same set. If it carries
  text, add its pairs to the contrast rules in `packages/design-tokens/src/contrast.test.ts`.
- **Code that cannot use CSS variables** (canvas, Phaser) reads the values with `parseTokens` from
  `@tohe/design-tokens`, given `tokens.css` imported with `?raw`.

## The player's choice

- **Choices:** *Theo máy* (system, the default), *Sáng* (light) and *Tối* (dark), from the round 🌗 / ☀️ / 🌙
  button in the top corner of hub screens. Picking one applies it at once.
- **Storage:** the choice belongs to the device and lives in the `tohe-theme` cookie:
  - values `light` or `dark`; no cookie means system;
  - path `/`, one year, `SameSite=Lax`, plus `Secure` on HTTPS;
  - cookies are per host, not per port, so the site on the same host can read the same choice.
- **Applying it:** `<html>` gets `data-theme` and `color-scheme` (for native controls and scrollbars), and
  `<meta name="theme-color">` gets the `bar` colour.
  - `apps/hub/public/theme-init.js` does this before the first paint: a blocking script in `<head>`, served from
    the hub's origin because the CSP forbids inline scripts.
  - `src/theme/theme.ts` then takes over: it follows live changes of the device setting and handles the picker.
  - `src/theme.test.ts` runs the init script against `theme.ts` for every cookie and device setting.

## Games

ADR 0013 lets games opt in through `themes` in `game.json` and `theme` in the protocol's `settings`. Until that
reaches the Game Contract, games keep their own look, while the hub's frame around them follows the hub.

## Checks

- `packages/design-tokens`: both themes define the same tokens; the token pairs meet WCAG AA in both themes.
- `apps/hub`:
  - no raw palette classes;
  - `theme-init.js` agrees with `theme.ts`;
  - the `theme-color` values equal the `bar` tokens.
- E2E smoke test (`tools/e2e`):
  - every hub screen is screenshotted in light and dark, with axe-core's colour-contrast rule in both;
  - the picker: dark survives a reload, and *Theo máy* follows the device live.
