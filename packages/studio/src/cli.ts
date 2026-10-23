#!/usr/bin/env node
// tohe-studio: make asset packs for the Studio (ADR 0051, docs/guides/make-assets.md). `tohe-studio help` for usage.
import { run } from './run.ts';
import { consoleIo } from './settings.ts';

run(process.argv.slice(2), {
  env: process.env,
  io: consoleIo,
  // Under pnpm, the folder it was run from.
  cwd: process.env.INIT_CWD || process.cwd(),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
