---
title: "0005: Offline first: games keep working without the API"
description: Local storage is the primary write target; the API is a sync and sharing layer.
sidebar:
  order: 5
---

- **Status:** Accepted — a ranked run needs the network when it starts, and only then, since
  [ADR 0030](0030-ranked-runs-replayed-by-the-server.md)
- **Date:** 2026-10-13

## Context

The backend runs on a homelab that has had outages (disk pressure, maintenance). Phones lose connectivity. A child
in the middle of a game must not notice either.

## Decision

- The hub is a PWA; its service worker precaches the app shell and caches `GET /api/games` and `/api/config`
  network-first. The hub keeps the last good copy of each in IndexedDB as well.
- Saves and scores are written to IndexedDB (Dexie) first, flagged `synced = 0`. A background sync (M2) pushes
  them to the API and pulls newer saves from other devices; last-writer-wins per (profile, game) with the server
  timestamp, and the losing version kept for one restore.
- Game builds are immutable and cached for a year; a games-origin service worker will make them fully available
  offline (spike S1).
- Static sites (landing, docs) and game builds can move to Cloudflare Pages/R2 if homelab downtime hurts, without
  code changes.

## Consequences

- Every new API feature must answer "what happens offline?" in its doc.
- Conflicts are possible when the same profile plays on two offline devices; the policy above resolves them.
- Debugging needs both IndexedDB and server views.

## Alternatives considered

- **Online only:** simplest, but fails the core promise for children and for homelab outages.
- **CRDT-based sync:** unnecessary for per-game blobs owned by one profile.
