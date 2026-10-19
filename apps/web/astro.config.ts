import { defineConfig } from 'astro/config';

// The public pages on the players' host (ADR 0042): static HTML that the hub image's Caddy serves at the root of the
// hub's origin, next to the app. Everything the build adds lives under one prefix of its own, /_web/, which is the
// `public-assets` namespace of @tohe/routes; the page itself is /, the `home` namespace.
export default defineConfig({
  // The hub's own URL, for canonical and Open Graph links. In the image it is a placeholder that the hub's Caddy turns
  // into TOHE_HUB_URL when the container starts, so one image serves every environment (ADR 0021, web.Dockerfile).
  site: process.env.TOHE_HUB_URL ?? 'http://localhost:4720',
  server: { port: 4711 },
  build: {
    assets: '_web',
    // The page's CSP allows no inline script and no inline style (Caddyfile.hub), so nothing is inlined: every script
    // and stylesheet is a file under /_web/. scripts/check-build.ts fails the build when one slips back in.
    inlineStylesheets: 'never',
  },
  vite: { build: { assetsInlineLimit: 0 } },
});
