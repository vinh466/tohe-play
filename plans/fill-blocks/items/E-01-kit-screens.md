# E-01 — Kit: a generic `screens` API for the shell

**Status:** done — shipped in `prod-2026-11-08.4` · **Kind:** enhancement · **Blocked by:** D-06

## What

The shell today has a fixed title, settings, how-to, leaderboard and credits. Lấp Ô needs a **Journey** map, a
**Daily** calendar, **Stats** and **Achievements** — all game-owned screens. Add a small, generic extension to
`createShell`:

```ts
screens?: Array<{
  id: string;
  icon: IconName;
  label: string;
  render(root: HTMLElement, api: { back(): void; theme: Theme; locale: Locale }): void | (() => void);
  back?: string; // label for the back button
}>;
```

- The shell owns navigation, Back/Escape, focus, safe area, theme and returning to the title.
- A screen's `render` returns a cleanup function; the shell calls it on leave.
- The title screen gains a second primary card (`Hành trình`) and a progress line (`Chương 2 · 8/18 sao`).
- No game-specific code in the shell; other games can use the same API.

## Why

- The journey is the long-progression spine; it cannot live as an overlay over the board without hurting the
  title screen's clarity.
- The shell is already the home of every non-play screen; a generic hook is smaller and more reusable than a
  Lấp Ô-specific hack.
- Stats/achievements/daily need the same navigation, so one API serves four screens.

## Options

- **A — generic `screens` + `modes`/`progress` on the title (recommended).** Small public API, tested with a
  fake screen, documented.
- **B — an overlay over the play stage.** No kit change, but the title cannot show progress and Back semantics
  are muddy.
- **C — a hub page per game.** Platform work, breaks game self-containment.

## Cost and risks

- Shell tests (navigation, Back, cleanup, theme change while a screen is open), docs and an ADR if the public
  shell API changes.
- Avoid turning the shell into a router; screens are content, not routes.
- Scroll behaviour and safe areas on a phone must be tested.
- Other games must not change behaviour when `screens` is absent.

## Evidence

- The shell's current options and structure: `packages/game-kit/src/shell.ts:210-255`,
  `docs/architecture/game-shell.md`.
- The shell has no free screen hook: [R-03](../research/R-03-platform-and-reuse.md).
- The UI/screen design: [D-06](../items/D-06-ui-and-shell.md).

## Discussion

**agent (2026-11-08):** recommend A. Build it with a fake screen test first; then Lấp Ô uses it for Journey,
Daily, Stats and Achievements. If the owner rejects the kit change, fall back to B for V2 and move the journey to
V3.
