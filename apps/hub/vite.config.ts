/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { covers, hubNamespaces, navigationAllowlist } from '@tohe/routes';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
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
 * The public pages (apps/web) are the hub's Caddy's in the image; under `pnpm dev` they are their own dev server's,
 * http://localhost:4711. A link of the app to /terms (the sign-up's consent) would be a page the app does not have, so
 * this sends the public pages' paths there. The root stays the app's catalog, as before.
 */
function publicPagesAreTheirOwnServer(): Plugin {
  const pages = hubNamespaces.filter(
    (namespace) => namespace.component === 'public' && namespace.indexed && namespace.path !== '/',
  );
  return {
    name: 'tohe:public-pages-are-their-own-server',
    configureServer: (server) =>
      void server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (!pages.some((namespace) => covers(namespace, url.pathname))) return next();
        const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
        response.statusCode = 302;
        response.setHeader('Location', `http://localhost:4711${path}${url.search}`);
        response.end();
      }),
  };
}

export default defineConfig({
  plugins: [
    publicPagesAreTheirOwnServer(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tò He',
        short_name: 'Tò He',
        description:
          'Game nhỏ, mở ra là chơi: không quảng cáo, không cần tài khoản. Giữ tiến độ khi bạn muốn, rủ bạn vào cùng bàn bằng một link.',
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
        // Long-press on the home-screen icon: straight into the reference game.
        shortcuts: [
          {
            name: 'Ghép Khối',
            short_name: 'Ghép Khối',
            url: '/play/merge-block',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        // What Android's install dialog shows next to "Cài Tò He"; made by `pnpm --filter @tohe/hub generate:screenshots`.
        screenshots: [
          {
            src: 'screenshots/catalog-light.png',
            sizes: '780x1688',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Danh sách game, nền sáng',
          },
          {
            src: 'screenshots/catalog-dark.png',
            sizes: '780x1688',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Danh sách game, nền tối',
          },
          {
            src: 'screenshots/catalog-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Danh sách game trên màn hình rộng',
          },
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
