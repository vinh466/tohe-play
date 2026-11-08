import { defineConfig } from 'vite';

export default defineConfig({
  // Builds are served from /<id>/<version>/ on the games origin, so every URL must be relative.
  base: './',
  server: { port: 4736, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
  },
});
