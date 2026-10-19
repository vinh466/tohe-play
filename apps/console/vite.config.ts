/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The console lives at the root of a host of its own (ADR 0027, 0042): http://localhost:4721 in development, as the
// hub image's second site serves it in compose. Only the API's console routes are proxied, as there; the API answers
// them on this host alone (App:ConsoleUrl) and with the console's own session. No service worker, on purpose.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4721,
    strictPort: true,
    // The Host header stays localhost:4721 (no changeOrigin): the API tells the console's host by it.
    proxy: { '/api/admin': { target: 'http://localhost:4740' } },
  },
  test: { environment: 'node' },
});
