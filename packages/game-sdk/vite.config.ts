// Builds the game side as standalone files for games without a bundler (Godot, plain HTML):
//   dist/tohe-game-sdk.iife.js  -> <script src>, exposes window.Tohe
//   dist/tohe-game-sdk.js       -> ES module
// TypeScript games in this monorepo import the source directly instead.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Tohe',
      formats: ['es', 'iife'],
      fileName: 'tohe-game-sdk',
    },
    target: 'es2022',
    sourcemap: true,
  },
});
