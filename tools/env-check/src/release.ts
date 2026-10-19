// Checks a commit before it is tagged, and prints the tag's name (ADR 0041). Read-only: git, the GitHub API, GHCR.
//
//   pnpm release:check <ref> --for uat     # a branch, a tag or a sha; run `git fetch origin --tags` first
//   pnpm release:check origin/main --for prod
import { parseArgs } from 'node:util';
import { scriptArgs } from './args.ts';
import { realFetch } from './http.ts';
import { Git } from './proc.ts';
import { checkRelease } from './release-checks.ts';
import { Runner } from './runner.ts';

const usage = 'usage: pnpm release:check <ref> --for uat|prod';
const { values, positionals } = parseArgs({
  args: scriptArgs(),
  options: { for: { type: 'string' } },
  allowPositionals: true,
});

if (positionals.length !== 1 || (values.for !== 'uat' && values.for !== 'prod')) {
  console.error(usage);
  process.exit(2);
}

const runner = new Runner();
try {
  await checkRelease(
    {
      ref: positionals[0] as string,
      for: values.for,
      now: new Date(),
      token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined,
    },
    { http: realFetch, git: new Git() },
    runner,
  );
  process.exitCode = runner.finish();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
