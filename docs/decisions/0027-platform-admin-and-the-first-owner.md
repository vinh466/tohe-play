---
title: "0027: Run the platform from an admin console on the hub's origin; roles grant permissions; a setup token makes the first owner"
description: The operator's console is its own app at /admin/ on the hub's origin, calling /api/admin through an OpenAPI document of its own. An account holds at most one platform role, which code reads as permissions. The first owner claims a new deployment with a setup token; a command in the API's container grants a role when every owner is lost.
sidebar:
  order: 27
---

- **Status:** Accepted — the console frames the games origin, only to watch a ranked run, since
  [ADR 0032](0032-watch-a-ranked-run-in-the-game-itself.md); the audit log keeps a year since [ADR 0034](0034-delete-accounts-and-profiles-for-good.md); the console moved to
  a host of its own, `console.toheplay.io.vn`, with a sign-in of its own — and the first owner's setup to its `/setup` —
  by [ADR 0042](0042-hosts-by-trust-paths-by-component.md)
- **Date:** 2026-10-18

## Context

Tò He cannot be looked after from the inside. Device health is read with a script and an operator token
(`/health-report`); the catalog sync and the email queue show only in logs; hiding a game, turning a sign-in method
off or renaming a rude profile needs the database. Opening to communities makes these weekly chores, done at times by
someone who is not a developer — a moderator — and on a public address, where "the first visitor becomes the owner"
hands the platform to whoever finds `/admin` first.

## Decision

- **A separate app**, `apps/admin` (React and the design tokens, desktop first), served at `/admin/` by the hub's
  server: the hub's origin, so the same session cookie and no CORS. It has no service worker, a strict CSP of its own
  and `noindex`, and can move to a host of its own behind an access proxy later without code changes.
- **An API surface of its own**: `/api/admin/*`, described by a separate OpenAPI document (`admin`), so the hub's
  generated types never contain an admin endpoint and the admin's contain nothing else.
- **Roles grant permissions.** An account holds at most one platform role — Owner, Admin, Moderator, Viewer — kept as
  an account claim. Code checks permissions (`admin.read`, later `admin.users.write`…), never role names, so what a
  role may do changes in one table. Every admin endpoint declares its permission or nobody can call it, and every
  admin request reads the role from the database: taking a role away works at once.
- **Modules keep their tables.** The admin module reads what each module exposes for it — counts, live rooms, queue
  sizes — never the tables themselves.
- **The first owner.** While no account is Owner, the API is in setup mode and logs once
  `No platform owner yet — open <hub>/admin/setup, token XXXX-XXXX` (or uses `Admin:SetupToken`). Whoever brings the
  token and signs in with a verified email becomes Owner — only an address in `Admin:BootstrapEmails`, when that is
  set — and setup mode ends for good. With every owner lost, `dotnet Tohe.Api.dll admin grant <email> --role owner`
  run inside the API's container grants the role again.
- **Protection.** The console needs two-factor authentication (TOTP); actions that change something need step-up level
  2 (ADR 0025); every action lands in an append-only audit log.
- **Not a second Grafana.** Infrastructure metrics stay in the cluster's Prometheus and Grafana; the console links
  there.

It arrives in steps. First the app, the API surface, roles and permissions, read-only pages — overview, games, device
health, system — and the command; then setup mode, two-factor authentication, step-up and the audit log; then users,
sign-in settings and registration modes. Production waits for the second step.

## Consequences

- The hub's image carries the admin's build. `/admin/` gets its own headers in the hub's Caddy, and the hub's service
  worker leaves it alone.
- Two OpenAPI documents, two generated type files; CI checks both for drift.
- Background workers report their last run to an in-memory record the System page reads. One API process runs them,
  as the rooms of ADR 0016 already assume.
- Locally the admin's dev server (4721) sits behind the hub's (4720) at `/admin/`, as in production.
- Until setup mode exists, the command is the only way to a role — enough for development and UAT.

## Alternatives considered

- **Admin pages inside the hub:** one app, but its service worker, offline storage and child-friendly screens would
  carry operator code and data to every phone, and splitting later is harder.
- **A separate admin origin from the start:** a second cookie and CORS for little gain while there is one operator;
  the app can still move.
- **ASP.NET Core Identity's role tables:** a migration and two tables to hold one value per account; account claims
  already exist.
- **The first visitor becomes the owner**, as many self-hosted apps do: safe only on a closed network.
- **A ready-made admin framework** (React Admin, Refine): quick tables and forms, at the cost of a second design
  system and its dependencies for a handful of pages.
