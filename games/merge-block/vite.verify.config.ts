import { defineConfig } from 'vite';

// The verify module (ADR 0030): src/verify.ts as one ES module, dist/verify.js, next to the game's own build. The API
// runs it in Jint to replay ranked runs; it must stay pure (no DOM, timers, network or Math.random).
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    minify: true,
    lib: { entry: 'src/verify.ts', formats: ['es'], fileName: () => 'verify.js' },
  },
});
