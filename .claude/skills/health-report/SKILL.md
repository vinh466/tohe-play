---
name: health-report
description: Read the platform's device telemetry (ADR 0015) — errors, frame times, load times, renderer fallbacks, sync failures per game version and device — and turn it into findings with likely causes and proposed fixes. Use when asked how the games are doing on players' devices, after a deploy to UAT, before choosing what to improve next, or to review the platform's health.
---

# Health report

Telemetry is technical data only (docs/architecture/telemetry.md). You read it through the report endpoint, never
the database: UAT's database holds the family's data (docs/guides/uat.md).

1. **Fetch the report** from the repository root:
   ```sh
   pnpm --filter @tohe/telemetry-report report -- --env uat --days 7   # the family's devices
   pnpm --filter @tohe/telemetry-report report -- --days 1             # the dev stack (localhost:4720)
   ```
   `--days` goes up to 30 (raw events); the "Daily" table comes from roll-ups. `--json` gives the raw report.
   After a deploy, compare the new version with the previous one: they are separate sections.
2. **Start from "Worth a look"**, most serious first:
   - 🆕 a new error, ❗ errors in more than 5 % of sessions, or protocol errors: find the code. The top frame is
     minified; rebuild that game version (`git checkout <commit>`, `vite build --sourcemap`) to map
     `file:line:column` to source, or search for the message.
   - 🐢 slow frames on one platform: compare its step p95 (the game's own work) with its frame times. A high step
     time is our code; a low step time with slow frames is drawing or the device (see the A55 case in
     docs/research/game-tech.md).
   - ⚠️ renderer fallbacks, lost WebGL contexts, blocked audio, failed starts or sync failures: group by device in
     the "Devices" and "Frames" tables before guessing.
3. **Read the newcomer funnel** (the "Newcomer funnel" section, or `funnel` in `--json`): `hub.funnel.*` counts per day
   and three ratios, which say whether the first minutes work for people who just arrived
   (docs/architecture/telemetry.md, "Newcomer funnel"):
   - `first-game / guest-start`: of the devices that arrived as guests, how many finished a game. Low means the
     catalog, loading or the first game lose them; cross-check the hub's `hub.game.failed`, `hub.game.first-screen-ms`
     and errors before blaming the design.
   - `install-accepted / install-offered.*`: how well the install offer lands. Look at the three variants (`prompt`,
     `ios`, `in-app`) in the totals: `in-app` is only an offer to open the real browser, so it has no accept.
   - `account-created / sign-in-opened`: how many guests who opened sign-in made an account. The server's side is
     `tohe_sign_ups` (Prometheus, by method and started/completed); you cannot read it through the report.
   - `standalone-open` per day: how often the installed app is used.
   The funnel is sums, not people: a once-per-device step and an every-time step are not the same people, a device with
   telemetry off is on neither side, and a week of a family's devices is a handful of events. Say "n/a" for a null
   ratio, never "0 %", and call a ratio over fewer than about 20 events a note, not a finding. Explain the direction
   over days and what it could mean (marked as a guess), and propose the change that would test it; never read it as
   something about a person.
4. **Weigh it**: a finding on one device of 20 sessions is a note; the same on half the devices is a priority.
   Headless browsers (conformance, e2e) are left out unless `--headless` is passed.
5. **Report** in the user's language: per finding, what the data shows (numbers), the likely cause (marked as a
   guess unless the code proves it), and the fix you propose. Propose issues or pull requests; change nothing on UAT
   and never turn telemetry off or on yourself.
6. If the report itself is missing something you needed, say what, and propose the new count or metric (names:
   `kit.*`, `hub.*`, `game.<id>.*`, lower-case, a metric ends in its unit) with the docs change it needs.
