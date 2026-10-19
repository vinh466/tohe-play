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
| `brand`, `brand-strong`, `on-brand` | Primary actions, their pressed state, and their text. Text on `brand` must be large (1.25rem bold); on `brand-strong` any size meets AA, as the admin console's buttons need |
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

- **Choices:** *Theo máy* (system, the default), *Sáng* (light) and *Tối* (dark). Picking one applies it at once,
  everywhere:
  - in the hub, from the round 🌗 / ☀️ / 🌙 button in the top corner of its screens;
  - on the public home page, from the three buttons in the top corner;
  - in the docs, from Starlight's own theme menu (*Auto / Light / Dark*).
- **Storage:** the choice belongs to the device and lives in the `tohe-theme` cookie:
  - values `light` or `dark`; no cookie means system;
  - path `/`, one year, `SameSite=Lax`, plus `Secure` on HTTPS;
  - cookies are per host, not per port, so the hub, the public pages and the docs on one host share the choice.
- **The code** lives in `@tohe/design-tokens`:
  - `theme` reads and saves the choice, resolves *Theo máy* against the device, and applies a theme: `<html>` gets
    `data-theme` and `color-scheme` (for native controls and scrollbars), and `<meta name="theme-color">` gets
    the `bar` colour;
  - `theme-init.js` does the same before the first paint, as a blocking script in `<head>`.
    `src/theme.test.ts` runs it against `theme.ts` for every cookie and device setting.
- **Where each page runs it:**
  - **Hub:** serves a copy of `theme-init.js` from its own origin (`public/`), because its CSP forbids inline
    scripts. A test keeps the copy identical to the original. `src/theme/theme.ts` then follows live changes of
    the device setting and drives the picker.
  - **Public pages** (`apps/web`): share the hub's origin and its CSP rule, so `theme-init.js` is a file under `/_web/`
    (the build emits it from `@tohe/design-tokens`); a small bundled script drives the buttons.
  - **Docs:** `src/components/ThemeProvider.astro` replaces Starlight's: it inlines `theme-init.js` and mirrors the
    cookie into Starlight's localStorage key, so Starlight's menu starts from the shared choice.
    `ThemeSelect.astro` wraps Starlight's menu to save changes in the cookie.
  - **Docs colours:** `src/styles/docs.css` maps Starlight's grey scale and accent onto the tokens, for both themes.

## Games

Games opt in; some games have one look by nature ([Game Contract](../contracts/game-contract-v1.md)).

- **Declaring:** `themes` in `game.json` is `["light"]` (the default), `["dark"]`, or `["light", "dark"]`.
- **Receiving:** the hub always sends the theme it shows, as `settings.theme` in `init` and in every `settings`
  message (for example when *Theo máy* turns dark mid-round). Games with one look ignore it; the hub's frame around
  them follows the hub anyway.
- **Following it** with `@tohe/game-kit`: `followTheme(session, onTheme)`.
  - It sets `data-theme` on the game's `<html>`, so the kit's cards and any CSS on the design tokens switch with
    it.
  - It calls `onTheme` so the game can redraw what it paints itself.
  - Phaser games also call `kit.setBackground(color)` for the canvas behind the scenes.
- **Colours:**
  - Game screens built from DOM (HUD, cards) use the tokens; the kit's `overlay.css` already loads them.
  - Game art keeps its own palette per theme, for example `games/merge-block/src/palette.ts`: the same blocks on
    a cream or a warm-charcoal board.
  - A small canvas game can read the tokens with `getComputedStyle` after a theme change (`games/hello`).
- **Checks:** for every declared theme, conformance screenshots the game and checks its DOM text with axe-core. A
  game declaring both must look different in each.
- **Loading:** the hub keeps its loading cover over the game until the handshake is done and fades it out, so the
  game's first frame is already in the right theme.

## Checks

- `packages/design-tokens`:
  - both themes define the same tokens, and the token pairs meet WCAG AA in both themes;
  - `theme-init.js` agrees with `theme.ts`;
  - the `theme-color` values equal the `bar` tokens.
- `apps/hub`: no raw palette classes; the copy of `theme-init.js` is identical to the original.
- Games: conformance in every declared theme (above); `games/merge-block` also tests that every number is readable
  on its block.
- E2E smoke test (`tools/e2e`):
  - every hub screen, the public home page and the docs are screenshotted in light and dark, with axe-core's
    colour-contrast rule in both;
  - the hub picker: dark survives a reload, and *Theo máy* follows the device live;
  - a choice made on the public home page also applies to the docs and the hub.
