/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
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
        start_url: '/',
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
        navigateFallbackDenylist: [/^\/api\//],
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
  ],
  server: {
    port: 4720,
    strictPort: true,
    proxy: { '/api': 'http://localhost:4740' },
  },
  preview: { port: 4720, strictPort: true, proxy: { '/api': 'http://localhost:4740' } },
  // Vitest empties CSS unless told otherwise; theme.test.ts reads the design tokens with `?raw`.
  test: { environment: 'node', css: { include: [/tokens\.css/] } },
});
