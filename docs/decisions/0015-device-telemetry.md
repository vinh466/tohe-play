---
title: "0015: Collect technical telemetry from players' devices, first-party and visible"
description: Games and the hub report errors, performance and compatibility data (never personal data) to the platform API, under one switch, with a report an agent can read.
sidebar:
  order: 15
---

- **Status:** Accepted (the owner took the proposed answers to every open question, 2026-10-15) — the switch is the
  account's since [ADR 0023](0023-accounts-own-their-profiles.md)
- **Date:** 2026-10-15

## Context

The owner, family and friends play on their own phones (Android and iPhone, several browsers). Problems there are
invisible to us. `log()` lines from games end in the phone's console, the kit's `#perf` readout is only shown on
screen, WebGL → Canvas fallbacks happen silently, and the hub has no error handler. The A55 lag (#21) was found
because someone said so, and was measured with the phone in hand.

The owner asked for a light, safe, transparent way to learn about performance, compatibility and errors from real
devices, and for agents to be able to read the results and find problems.

Constraints:

- Games run sandboxed on their own origin and never call the API or the network (ADR 0002).
- Players include children. Vietnam's Law on Personal Data Protection (91/2025/QH15) has been in force since
  2026-01-01 and protects children's data.
- UAT holds the family's data; agents must not touch its database by hand (ADR 0010).
- What browsers expose differs. LCP and INP have been measurable in Safari since 26.2, though Safari's INP is
  reported as unreliable. Long Animation Frames and crash reports are Chromium only. The GPU renderer string is
  masked in Safari and is a fingerprint in Chrome.

## Decision

- **Technical data only**, as listed in [Device telemetry](../architecture/telemetry.md): device and software
  context, errors, performance summaries, compatibility events, and (if the owner agrees) per-game usage counts. Never
  names, accounts, profiles, households, saves, scores, IP addresses, typed text or fingerprints.
- **First-party:** the hub batches and sends to a new `Telemetry` module of the API (own `telemetry` schema). No
  third-party script or service.
- **Games report through the hub.** An additive protocol message, `telemetry`, carries four kinds of event (`error`,
  `count`, `metric`, `frames`) and is sent only when `init.telemetry` is true. SDK 0.4.0 gives games
  `session.telemetry` and captures their uncaught errors; the kit adds frame summaries, renderer and audio events
  when given it. The protocol stays at 1: older games send nothing, older hubs leave `init.telemetry` out.
- **Three switches, on by default:** the server's (`Telemetry:Enabled`, read by the hub from `GET /api/config`), the
  household's (behind the parent gate) and the device's (on the transparency page, guests included). A page shows
  what is sent and the last batch exactly as sent.
- **Budgets:** client-side summaries, at most one request per minute, 16 KB per batch, `sendBeacon`, silent
  failure; the API refuses more than 200 events or 32 KB, and the conformance kit holds every game to its budget.
- **Device id:** random, renewed every 30 days, tied to no account. The API reduces the User-Agent to families and
  major versions and does not store it.
- **Retention:** raw events 30 days, daily roll-ups one year.
- **Agent access through a report, not the database:** `GET /api/telemetry/report`, protected by an operator
  token, a tool that prints it as Markdown, and a `/health-report` skill. Agents propose fixes; they never act on
  telemetry by themselves.

Not done: session replay, screenshots, per-profile analytics, A/B testing, third-party analytics, alerting (an
optional export to the homelab's Grafana comes later, in phase 3).

## Consequences

- Problems on real phones show up with their game version and device class, before anyone reports them, and
  regressions can be tied to a deploy.
- New code to keep: a hub collector, small additions to the SDK and kit, an API module with a retention job, a
  transparency page, the report tool and skill.
- Every new field needs [Device telemetry](../architecture/telemetry.md) updated in the same pull request, and the
  transparency page with it.
- The conformance kit runs every game with telemetry on and checks it stays within budget; the SDK's tests check
  that it sends nothing when off.
- UAT gains a secret, `TOHE_UAT_TELEMETRY_TOKEN`, which `deploy/uat/deploy.sh` adds to `uat.env` once.

## Alternatives considered

- **OpenTelemetry in the browser, a collector and the homelab's Grafana stack:** standard and powerful. But the
  browser SDK is much heavier than our budget, it adds a collector service and cross-origin plumbing, and the
  questions we ask are a few per-version summaries. It can still be an export target later.
- **Self-hosted Sentry or GlitchTip for errors:** good grouping and UI, but another service with its own database and
  queue to run and back up, and an SDK in every game, for a handful of devices.
- **A third-party service:** children's device data would leave the home, and games would need network access
  outside their origin (ADR 0002).
- **Ask players to report problems:** what we do today. It misses most problems and needs the phone in hand.
