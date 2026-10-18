/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The admin console lives at /admin/ on the hub's origin (ADR 0027). In development the hub's dev server (4720)
// proxies /admin here, so the session cookie and /api are the hub's, as in production: open
// http://localhost:4720/admin/. No service worker, on purpose.
export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 4721,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:4740' } },
  },
  test: { environment: 'node' },
});
