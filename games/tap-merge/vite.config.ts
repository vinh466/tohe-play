import { defineConfig } from 'vite';

export default defineConfig({
  // Builds are served from /<id>/<version>/ on the games origin, so every URL must be relative.
  base: './',
  server: { port: 4733, strictPort: true },
  build: {
    target: 'es2022',
    // Phaser is one ~1.4 MB module that cannot be split further; the size budget is checked by conformance.
    chunkSizeWarningLimit: 1600,
  },
});
