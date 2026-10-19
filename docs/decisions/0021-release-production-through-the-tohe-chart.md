---
title: "0021: Release production through the Tò He Helm chart"
description: One set of images for every environment, configured at run time; Tò He owns a Helm chart that platform-infra deploys to production, and UAT runs the same images.
sidebar:
  order: 21
---

- **Status:** Accepted — promotion follows a `prod-` tag, and the agent merges its pull request, since
  [ADR 0041](0041-promote-one-build-through-the-environments-by-tag.md); HSTS covers subdomains, and the site image is to serve
  only the developer docs, by [ADR 0042](0042-hosts-by-trust-paths-by-component.md)
- **Date:** 2026-10-18
- **Amends:** [ADR 0010](0010-environments-dev-and-uat.md) — production is no longer deferred

## Context

ADR 0010 deferred production until it was needed. The owner decided on 2026-10-17 that Tò He opens to a few small
communities, and that production runs on the owner's VPS cluster, which the `platform-infra` repository manages with
GitOps: ArgoCD, secrets from Infisical, a shared CloudNativePG PostgreSQL backed up to R2, Traefik behind Cloudflare
(TLS ends at Cloudflare). The owner asked for a chart that "runs standalone from scratch and stays open to
customisation, so the platform can plug in secrets, the database and more without breaking it" — the infrastructure
side runs infrastructure, the Tò He side answers for the product.

What stands in the way today:

- UAT builds its images on the machine from a git export (ADR 0010), so what the family tested is not, byte for byte,
  what another environment would run.
- The site bakes its own URL and the hub's into the build (`PUBLIC_HUB_URL`, `TOHE_SITE_URL` as build arguments).
- The session cookie is `Secure` only when the request is HTTPS. Behind Cloudflare → ingress → the hub's Caddy, the
  API sees plain HTTP whatever the visitor used, and `X-Forwarded-Proto` does not survive every hop (Traefik discards
  forwarded headers from senders it does not trust).
- The hub's Caddy treats its direct peer as the visitor. Behind an ingress that peer is the ingress, so the API's
  per-address rate limit on sign-in would put every visitor in one bucket.

## Decision

1. **One set of images for every environment, configured when they start.**
   - API: `App:PublicUrl` is the hub's public URL. With `https`, every request counts as HTTPS, the session cookie is
     always `Secure` and is named `__Host-tohe.session` — the prefix forbids a `Domain` attribute, so a sibling
     subdomain of the same site, the games origin among them, can neither set nor shadow it. Unset in local
     development; plain `http` on UAT, which keeps today's cookie.
   - Hub (Caddy): `TOHE_TRUSTED_PROXIES` names the proxies allowed to say who the visitor is, and
     `TOHE_CLIENT_IP_HEADERS` the headers they say it in (`CF-Connecting-IP` behind Cloudflare). The default trusts
     nobody — the hub is the edge on UAT and in compose. Caddy hands the API the address it worked out.
   - Site: `PUBLIC_HUB_URL` and `TOHE_SITE_URL`. The play button leads to `/play`, which Caddy redirects to the hub;
     the site's own URL (canonical links, sitemap, `llms.txt`) is built as a placeholder that Caddy fills in.
   - All three web origins send `Strict-Transport-Security` for one year, without `includeSubDomains` — the
     neighbouring hosts are not ours to pin. Browsers ignore it over plain HTTP.
2. **Tò He owns a Helm chart** (`deploy/helm/tohe`), modelled on the `platform` chart: each piece of infrastructure
   is `builtin` (runs from scratch) or `external` (the operator's), secrets come from the chart or from an
   `existingSecret`, the ingress can be switched off, and the usual extension points (annotations on the Deployment
   itself, environment, volumes, scheduling) are open. The chart enforces what the product needs: one API replica
   (ADR 0016), the URLs, a schema for its values.
3. **CI publishes** the images (`ghcr.io/vinh466/tohe-play/<api|hub|games|site>:sha-<commit>`) and the chart
   (`oci://ghcr.io/vinh466/charts/tohe`, version `<Chart.yaml version>-g<short sha>`). The repository is public, so
   pulling needs no credentials.
4. **UAT runs the published images** of the commit it deploys instead of building them; the deploy script still
   exports nothing else, backs up first and waits for health (ADR 0010).
5. **Production is a component of `platform-infra`** (`apps/tohe`): the chart with external PostgreSQL (a role and a
   database on the shared server), secrets from Infisical, Traefik ingress behind Cloudflare. Promoting a commit is a
   pull request against `platform-infra` that the owner merges.

Not done: more than one API instance (ADR 0016), Redis, building images on a deployment machine.

## Consequences

- This ADR lands with item 1; the chart (2), publishing (3), the UAT switch (4) and the `platform-infra` component (5)
  follow in their own pull requests.
- The images' run-time configuration is documented in one place: [Configuration](../guides/configuration.md).
- `TOHE_TRUSTED_PROXIES` must stay narrow (the ingress's pod range): anyone inside a trusted range can claim any
  address and walk around the sign-in rate limit.
- On an HTTPS deployment the cookie's name changes, which signs everyone out once. Only production uses HTTPS, and it
  has no users yet.
- The site's HTML, XML and text responses are templated per request — a small cost for a static site; the image build
  fails if the placeholder ends up in any other kind of file.
- The API still believes any `X-Forwarded-For` it receives, which is only right while nothing but the hub can reach
  it: in a cluster that is the chart's job (a ClusterIP Service, a NetworkPolicy option).

## Alternatives considered

- **Build images per environment** (site URLs baked in, as today): what UAT tested would not be what production runs,
  and nobody else could run the published images.
- **Trust `X-Forwarded-Proto` to decide HTTPS:** it does not survive the Cloudflare → Traefik → Caddy chain without
  every hop trusting the one before, which is configuration Tò He does not own; the public URL is known up front.
- **A wildcard or broad trusted range by default:** convenient behind any proxy, but on UAT and in compose it would let
  any device on the network choose its own address.
- **Docker Compose on a VPS, or the homelab k3s cluster:** considered in the plan; the owner chose the cluster
  `platform-infra` already runs, with its backups, secrets and monitoring.
