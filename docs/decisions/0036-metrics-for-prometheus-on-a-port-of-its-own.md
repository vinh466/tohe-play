---
title: "0036: Export metrics for Prometheus with prometheus-net, on a port of the API's own"
description: The API serves /metrics on port 9464, never proxied by the hub — every .NET meter (ASP.NET Core's requests, the runtime, Npgsql) plus Tò He's own numbers written with System.Diagnostics.Metrics — so the cluster's Prometheus scrapes it and alerts on what goes wrong before players notice.
sidebar:
  order: 36
---

- **Status:** Accepted
- **Date:** 2026-10-18

## Context

Production runs on the `platform-infra` cluster, where kube-prometheus-stack scrapes any ServiceMonitor; the `tohe`
chart already reserves `metrics.serviceMonitor.enabled` (D-14). The API had only `/api/health` and the console's
System page, which tell something only to whoever opens them: nothing would say that the API is down, that errors
climb, that email is stuck or that a worker keeps failing.

The owner decided E-08 on 2026-10-18 ("ok như bạn đề xuất, làm đi"): **A**, prometheus-net — the stable exporter;
OpenTelemetry's Prometheus exporter is still a beta — with the six alerts proposed (Q3). Where alerts go (Q2) is the
cluster's Alertmanager, decided in `platform-infra`.

## Decision

- **prometheus-net.AspNetCore** serves `/metrics` from a Kestrel listener of its own on **port 9464**
  (`Metrics:Port`; 4741 on the dev stack), never the API's 8080: the hub's Caddy proxies only 8080, so the metrics
  are not on the internet; in the cluster a NetworkPolicy opens 9464 to the monitoring namespace only.
- **Every .NET meter is exported** by prometheus-net's meter adapter: ASP.NET Core's request duration by route
  pattern and status (the seconds' buckets ASP.NET Core advises), the runtime's meter (its event counters are left
  out — they say the same), Npgsql's connection pool, EF Core's. The adapter starts listening when the API starts,
  so nothing counted before the first scrape is lost.
- **Tò He's own numbers are written with `System.Diagnostics.Metrics`** (`ToheMetrics`, meter `tohe`): moving to
  OpenTelemetry later changes the exporter, not the code that counts. Counted where things happen — emails sent and
  given up on, sign-ins by method and outcome; read every 30 seconds by a sampler in the Admin module, which puts
  together what each module tells as the console's overview does — tables, the outbox, held results, ranked runs
  waiting, the database answering; read from `BackgroundWork` — each worker's failures in a row and the age of its
  last good run.
- **Labels are bounded**: route patterns, methods, statuses, worker names, sign-in methods and outcomes — never a
  profile, an account, an address, a room code or a raw path.
- **Alerts** (in the chart, E-08's table): the API not scraped for 5 minutes; the database down for 5; over 5 % 5xx
  in 10 minutes with over 20 requests; p95 over 1 second for 15; email waiting over 15 minutes or given up within the
  hour; a worker failing 3 times in a row.
- Device telemetry (ADR 0015) stays where it is: what phones report is read in the console, not in Prometheus.

## Consequences

- One NuGet package (`prometheus-net.AspNetCore` 8.2.1) and one port more in the API's image (`EXPOSE 8080 9464`).
- prometheus-net exports a .NET counter as a gauge that only grows and starts again at 0 when the API restarts;
  PromQL's `increase()` reads it as a counter. Real counters come with OpenTelemetry, if it ever replaces the exporter.
- Exported names follow the meters: `microsoft_aspnetcore_hosting_http_server_request_duration_*`,
  `system_runtime_dotnet_*`, `tohe_*` ([Metrics](../architecture/metrics.md) lists them); the alert rules use them.
- Tests turn the server off (one port per machine); one test turns it on, on a free port, and scrapes it.

## Alternatives considered

- **OpenTelemetry with its Prometheus exporter**: the standard, but the exporter is a beta in production.
- **OpenTelemetry over OTLP** to Prometheus or a collector: stable packages, but a change in `platform-infra` first.
- **No metrics, logs and the console only**: nothing would alert anyone.
- **`/metrics` on the API's port**: one port fewer, but the hub's proxy, or a mistake in it, would put it on the
  internet; a port of its own needs no rule to stay private.
