---
title: "0010: Environments: development and UAT on the homelab"
description: Two Docker Compose environments on one machine — dev for building, UAT for the family; production deferred.
sidebar:
  order: 10
---

- **Status:** Accepted — production decided by [ADR 0021](0021-release-production-through-the-tohe-chart.md)
- **Date:** 2026-10-13

## Context

The platform is used only by the owner's family and devices, which reach the homelab over WireGuard/LAN at
10.100.0.2. The owner wants one environment for unrestricted development and one stable environment the family
can use every day, and will consider a public production deployment only when it is needed. The roadmap's M4
("production on k3s") assumed otherwise.

## Decision

- **Development** — compose project `tohe`, ports 47xx (ADR 0009). Agents may start, stop, rebuild and wipe it
  freely. `TOHE_PUBLIC_HOST` exposes it to other devices for quick tests.
- **UAT** — compose project `tohe-uat` on the homelab (`compose.uat.yaml`), ports 48xx (hub 4820, site 4810, games
  4830), API and database unpublished, `restart: unless-stopped`, its own volume. It is the family's environment:
  - deployed only with `deploy/uat/deploy.sh`, from an exact git commit exported with `git archive`, normally
    `origin/main` with green CI;
  - the database is backed up before every deploy (newest 20 dumps kept);
  - secrets (database password) live in `~/.config/tohe-uat/uat.env`, never in git;
  - the API reports the deployed commit in `GET /api/config` (`App:Version`).
- **Production** is deferred. When needed it gets its own ADR (HTTPS, k3s or compose, off-machine backups).

## Consequences

- The family's data lives in UAT; agents must never wipe the `tohe-uat` project or volume, and must deploy through
  the script so a backup exists.
- UAT is plain HTTP inside the VPN: no service worker/PWA install on phones and non-`Secure` cookies. Acceptable
  inside WireGuard; HTTPS comes with production.
- Two stacks on one machine use more memory (two PostgreSQL instances); acceptable at this size.
- Roadmap M4 becomes "UAT on the homelab" (done) and production moves to "later".

## Alternatives considered

- **UAT on the homelab k3s cluster:** consistent with the platform project's GitOps setup, but adds charts,
  ingress and secrets plumbing for an environment used by a few people; compose is simpler and enough for now.
- **Only one environment:** development would keep breaking the family's games.
