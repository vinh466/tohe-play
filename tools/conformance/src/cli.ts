#!/usr/bin/env node
// Usage: tohe-conformance <dist-dir> [--monkey-ms 4000]
import { runConformance } from './run.ts';

const args = process.argv.slice(2);
const dist = args.find((a) => !a.startsWith('--')) ?? 'dist';
const monkeyIndex = args.indexOf('--monkey-ms');
const monkeyMs = monkeyIndex >= 0 ? Number(args[monkeyIndex + 1]) : undefined;

const result = await runConformance(dist, { monkeyMs });
console.log(`\nConformance: ${result.gameId ?? dist}`);
for (const check of result.checks) {
  console.log(
    `  ${check.ok ? '✔' : '✘'} ${check.name}${check.detail ? `\n      ${check.detail.replaceAll('\n', '\n      ')}` : ''}`,
  );
}
for (const screenshot of result.screenshots) console.log(`  screenshot: ${screenshot}`);
console.log(result.ok ? '\nPASS' : '\nFAIL');
process.exit(result.ok ? 0 : 1);
