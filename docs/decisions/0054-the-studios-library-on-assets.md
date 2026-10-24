---
title: "0054: Serve the Studio's published library from assets., and nothing else of its bucket"
description: The Asset Studio's approved files and manifests are read from assets.toheplay.io.vn, a Cloudflare R2 custom domain on Tò He's zone that serves only blobs/ and packs/ — drafts and the rest of the bucket are refused at the edge — with no session and no code of Tò He's.
sidebar:
  order: 54
---

- **Status:** Accepted
- **Date:** 2026-10-24
- **Amends:** [ADR 0042](0042-hosts-by-trust-paths-by-component.md) — a new host; [ADR 0051](0051-an-asset-studio-for-game-assets.md)
  — where the library's public files are read from.
- **Decided by:** the owner, 2026-10-24, setting up the bucket and its domain from the agent's guide (plans/asset-studio
  S2: "xong R2 với DNS rồi đó, làm tiếp đi").

## Context

ADR 0051 publishes each approved pack version to object storage — its files under `blobs/sha256/<sha256>.<ext>`, its
manifest under `packs/<id>/<version>.json` — public to read, so a build needs no API and no credential; drafts sit in the
same bucket under `drafts/` and must stay private. Production's storage is Cloudflare R2, whose public access is per
bucket: a custom domain or the rate-limited `r2.dev` address serves every object. A new host on Tò He's domain needs an
ADR (ADR 0042).

## Decision

- **`assets.toheplay.io.vn`** is the library's public address: an R2 custom domain on the bucket `tohe-studio`, in
  Tò He's Cloudflare zone. It is the API's `Studio:Storage:PublicBaseUrl`, the build tool's `TOHE_ASSETS_REGISTRY` (a
  repository variable for CI) and the Studio app's `STUDIO_STORAGE_ORIGIN`.
- **Only `blobs/` and `packs/` are served.** A WAF custom rule on the zone blocks every other path on that host
  (`drafts/`, `styles/`, the bucket's root). `r2.dev` stays off.
- **Its plane is the edge** (ADR 0046): static files, no session, no cookie, no code of Tò He's; `noindex` is not needed
  because nothing links to it from a page meant to be indexed.
- Files are content-addressed, so they can be cached for good; manifests never change once written (ADR 0051).

## Consequences

- `@tohe/routes` lists the host (`assets`, serving) and the hosts page names it.
- Moving off R2 or changing the domain changes three settings together (the API's, CI's variable, the Studio's CSP)
  and nothing in the code.
- If the WAF rule is removed, drafts become readable: the self-hosting docs and the asset-studio page say the rule is
  part of the setup.

## Alternatives considered

- **`r2.dev`**: no DNS to manage, but rate-limited and meant for development.
- **A second bucket for drafts**: no edge rule to keep, but two buckets, two sets of credentials and a copy across
  buckets on approval; the rule is simpler while one bucket holds both.
- **Serving files through the API**: one origin and full control, but every build's download would load the homelab;
  the edge serves immutable files better.
