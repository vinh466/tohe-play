---
title: "0015: Collect technical telemetry from players' devices, first-party and visible"
description: Games and the hub report errors, performance and compatibility data (never personal data) to the platform API, under one switch, with a report an agent can read.
sidebar:
  order: 15
---

- **Status:** Proposed
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
- **Games report through the hub.** An additive protocol message, `telemetry`, is sent only when `init` says
  telemetry is on. The SDK captures a game's uncaught errors; the kit adds frame summaries and renderer events. The
  protocol stays at 1. The contract change, its docs and a conformance check land together in the first
  implementation pull request.
- **One switch:** a household setting behind the parent gate, a server-side kill switch in `GET /api/config`, and
  a page that shows what is sent, including the last batch.
- **Budgets:** client-side summaries, at most one request per minute, 16 KB per batch, `sendBeacon`, silent
  failure.
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
- The conformance kit checks a game's telemetry stays within budget and stops when telemetry is off.
- The open questions on the architecture page (default on or off, device id, usage counts, guests, retention,
  readers) are answered by the owner before this ADR is accepted.

## Alternatives considered

- **OpenTelemetry in the browser, a collector and the homelab's Grafana stack:** standard and powerful. But the
  browser SDK is much heavier than our budget, it adds a collector service and cross-origin plumbing, and the
  questions we ask are a few per-version summaries. It can still be an export target later.
- **Self-hosted Sentry or GlitchTip for errors:** good grouping and UI, but another service with its own database and
  queue to run and back up, and an SDK in every game, for a handful of devices.
- **A third-party service:** children's device data would leave the home, and games would need network access
  outside their origin (ADR 0002).
- **Ask players to report problems:** what we do today. It misses most problems and needs the phone in hand.
