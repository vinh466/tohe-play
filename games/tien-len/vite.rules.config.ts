import { defineConfig } from 'vite';

// The rules module (ADR 0016): src/module.ts as one ES module, dist/rules.js, next to the game's own build. The API
// runs it in Jint to referee online tables; it must stay pure (no DOM, timers, network or Math.random).
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    minify: true,
    lib: { entry: 'src/module.ts', formats: ['es'], fileName: () => 'rules.js' },
  },
});
