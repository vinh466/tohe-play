// The Vite plugin for a game with assets (ADR 0053): at build time, studio/ — every file the lock pins, by hash, a copy
// of the lock and the credits. It reads only the lock and never resolves. A game without assets is left as it was.
import type { Plugin } from 'vite';
import { gameFolder } from './game.ts';
import type { AssetsOptions } from './options.ts';
import { type StudioOutput, studioOutputs } from './studio.ts';

export type { AssetsOptions } from './options.ts';

/** `plugins: [toheAssets()]` in a game's vite.config.ts; the game's folder is Vite's root. */
export function toheAssets(options: AssetsOptions = {}): Plugin {
  let root = process.cwd();
  let outputs: StudioOutput[] | null = null;
  return {
    name: 'tohe-assets',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    async buildStart() {
      outputs = await studioOutputs(gameFolder(root), options);
    },
    generateBundle() {
      for (const output of outputs ?? [])
        this.emitFile({ type: 'asset', fileName: output.fileName, source: output.source });
    },
  };
}
