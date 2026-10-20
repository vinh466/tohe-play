---
title: Metrics
description: What the API exports for Prometheus on a port of its own — requests, the runtime, the database pool and Tò He's own numbers — with bounded labels, and how the chart scrapes and alerts on them.
sidebar:
  order: 10
---

Decision: [ADR 0036](../decisions/0036-metrics-for-prometheus-on-a-port-of-its-own.md) (E-08). Device telemetry —
what players' phones report — is something else, read in the console ([Telemetry](telemetry.md)); it never goes to
Prometheus.

## Where

The API serves `/metrics` in Prometheus' text format on **port 9464** (`Metrics:Port`; 4741 on the dev stack), a
Kestrel listener of its own beside the API's 8080. The hub's Caddy proxies only 8080, so `/metrics` is never on the
internet; in the cluster the chart's ServiceMonitor scrapes 9464 and a NetworkPolicy lets only the monitoring
namespace reach it. On UAT nothing scrapes it: the port is not published.

`Metrics:Enabled` turns it off (tests do: each host would take the same port). `Metrics:SampleInterval` (30 seconds)
is how often the numbers that come from the database are read again.

## What

Everything a .NET meter publishes is exported by prometheus-net's meter adapter, named `{meter}_{instrument}` with
dots made underscores. Counters of .NET meters come out as gauges that only grow, and start again at 0 when the API
restarts — PromQL's `increase()` reads them as counters.

| Metric | Labels | From |
| --- | --- | --- |
| `microsoft_aspnetcore_hosting_http_server_request_duration_{bucket,sum,count}` | `http_route` (the route's pattern, never a raw path), `http_request_method`, `http_response_status_code` | ASP.NET Core; buckets 5 ms … 10 s |
| `microsoft_aspnetcore_hosting_http_server_active_requests` | method | ASP.NET Core |
| `system_runtime_dotnet_*` | — | the runtime: GC, thread pool, JIT, CPU, working set |
| `npgsql_db_client_connection_count`, `…_max` | pool, state | Npgsql's connection pool |
| `process_*` | — | prometheus-net: CPU seconds, memory, open handles, start time |
| `tohe_database_up` | — | 1 when the database answered the last sample |
| `tohe_rooms_open`, `tohe_rooms_playing`, `tohe_rooms_connected` | — | tables open, in a hand, people connected ([Rooms](rooms.md)) |
| `tohe_email_outbox_waiting`, `tohe_email_outbox_oldest_seconds` | — | the outbox ([ADR 0022](../decisions/0022-send-transactional-email-through-an-outbox.md)) |
| `tohe_email_sent`, `tohe_email_failed` | — | emails the relay took; emails given up on after every try |
| `tohe_worker_failures_in_row`, `tohe_worker_last_success_age_seconds` | `worker` | each background worker, as the console's System page shows it ([Admin console](admin.md#background-work)) |
| `tohe_integrity_held`, `tohe_ranked_replays_waiting` | — | results held for a person; ranked runs waiting for their replay ([Integrity](integrity.md)) |
| `tohe_account_deletions_due` | — | accounts whose seven days are over, waiting for an admin to delete them ([Identity](identity.md#deleting)) |
| `tohe_sign_ins` | `method` (`password`, `google`, `github`, `oidc`), `outcome` (`ok`, `refused`, `locked`) | every sign-in |
| `tohe_sign_ups` | `method` (`password`, `google`, `github`, `oidc`), `outcome` (`started`, `completed`) | every sign-up: `started` when the code is sent (password) or a new provider identity is back and waits for its last step; `completed` when the account exists |

Labels are always bounded: never a profile, an account, an address, a room code or a raw path. The `tohe_` gauges
of tables, the outbox, held results, replays and accounts due for deletion are read every sample by the Admin module's sampler, which puts
together what each module tells — as the console's overview does — so the metrics never read another module's tables.
The counters are counted where things happen: the email worker, the sign-in and sign-up endpoints.

`tohe_sign_ups` is the server's half of the newcomer funnel ([Telemetry](telemetry.md#newcomer-funnel)): aggregate, no
account, address or provider subject. A password sign-up for an address that already has an account is not counted
(the person is sent the way back in, not a code), nor a provider that vouches for an existing account's address (that
one is linked). A provider whose address is not vouched for counts as `started` before it is known whether it
becomes a sign-up or a link, so `completed` over `started` is a floor for that method, not an exact rate.

## Alerts

The `tohe` chart's `PrometheusRule` (`metrics.prometheusRule.enabled`, with its ServiceMonitor and NetworkPolicy — a
PR of the chart's own) holds six, as E-08 set them; who receives them is the cluster's Alertmanager, configured in
`platform-infra`.

| Alert | When | Severity |
| --- | --- | --- |
| `ToheApiDown` | Prometheus has not scraped the API for 5 minutes | critical |
| `ToheDatabaseUnhealthy` | `tohe_database_up` is 0 for 5 minutes | critical |
| `ToheApiErrors` | more than 5 % of requests answer 5xx over 10 minutes, with more than 20 requests | warning |
| `ToheApiSlow` | the 95th percentile of request time is over 1 second for 15 minutes | warning |
| `ToheEmailStuck` | the oldest email has waited more than 15 minutes, or one was given up on in the last hour | warning |
| `ToheWorkerFailing` | a background worker failed 3 times in a row | warning |
