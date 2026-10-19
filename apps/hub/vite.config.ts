/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { hubNamespaces, navigationAllowlist, redirectTarget } from '@tohe/routes';
import react from '@vitejs/plugin-react';
import { type Connect, defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The 404 page is not the app: vite-plugin-pwa links the manifest and registers the service worker in every page it
 * builds, so a mistyped path would install the app. This strips both from 404.html, after the PWA plugin ran.
 */
function notFoundIsNotTheApp(): Plugin {
  return {
    name: 'tohe:not-found-is-not-the-app',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) =>
        ctx.filename.endsWith('404.html')
          ? html
              .replace(/\s*<link rel="manifest"[^>]*>/g, '')
              .replace(/\s*<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, '')
          : html,
    },
  };
}

/**
 * What the hub's Caddy answers before the app: the root leads to the catalog (302) and the app's old paths to the new
 * ones (301), both from the map in @tohe/routes (ADR 0042). `pnpm dev` and `vite preview` have no Caddy, so this does
 * it, and http://localhost:4720 still opens the catalog.
 */
function redirectsLikeTheHub(): Plugin {
  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const root = hubNamespaces.find((n) => n.served === 'redirect' && n.path === url.pathname);
    const moved = redirectTarget(url.pathname);
    const to = root?.redirectTo ?? moved;
    if (to === undefined) return next();
    response.statusCode = root ? 302 : 301;
    response.setHeader('Location', `${to}${url.search}`);
    response.end();
  };
  return {
    name: 'tohe:redirects-like-the-hub',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig({
  plugins: [
    redirectsLikeTheHub(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tò He',
        short_name: 'Tò He',
        description: 'Góc chơi nhỏ của cả nhà',
        lang: 'vi',
        // The app's identity stays "/" whatever its start page; it starts at the catalog and is scoped to the whole
        // origin, whose pages the service worker answers only inside the map's namespaces (ADR 0042).
        id: '/',
        start_url: '/play',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fff7ed',
        theme_color: '#f97316',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Only the app's own pages, from the map in @tohe/routes (ADR 0042): /api, the platform's files and unknown paths
        // go to the network.
        navigateFallbackAllowlist: navigationAllowlist(),
        // The root is the public home page (apps/web), not the app: never answer "/" with the precached index.html,
        // which Workbox would do by default for a URL ending in "/" (ADR 0042).
        directoryIndex: null,
        // The 404 page is the hub's Caddy's answer to a path in no namespace, never the app's.
        globIgnores: ['**/node_modules/**/*', '404.html'],
        runtimeCaching: [
          {
            // Catalog and config stay usable offline; fresh data wins when the API answers.
            urlPattern: ({ url }) => url.pathname === '/api/games' || url.pathname === '/api/config',
            handler: 'NetworkFirst',
            options: { cacheName: 'tohe-api', networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
    notFoundIsNotTheApp(),
  ],
  build: {
    rolldownOptions: {
      // The app, and the page the hub's Caddy answers 404 with (deploy/docker/Caddyfile.hub).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 4720,
    strictPort: true,
    proxy: {
      // ws: the rooms hub's WebSocket (ADR 0016) goes through the same /api proxy. The console has a host of its own
      // (ADR 0042): its dev server is http://localhost:4721.
      '/api': { target: 'http://localhost:4740', ws: true },
    },
  },
  preview: { port: 4720, strictPort: true, proxy: { '/api': { target: 'http://localhost:4740', ws: true } } },
  test: { environment: 'node' },
});
