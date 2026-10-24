/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Studio lives at the root of a host of its own (ADR 0051): http://localhost:4722 in development, as the hub
// image's third site serves it in compose. Only the API's Studio routes are proxied, as there; the API answers them on
// this host alone (App:StudioUrl) and with the Studio's own session. No service worker, on purpose.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4722,
    strictPort: true,
    // The Host header stays localhost:4722 (no changeOrigin): the API tells the Studio's host by it.
    proxy: { '/api/studio': { target: 'http://localhost:4740' } },
  },
  test: { environment: 'node' },
});
