// Checks UAT on the homelab (docs/guides/uat.md, ADR 0041). Read-only: GET and HEAD, `docker compose logs` and one SELECT.
//
//   pnpm check:uat                        # expects the commit of the newest uat- tag
//   pnpm check:uat --expect <ref>         # expects the commit of a tag, branch or sha
//   pnpm check:uat --since 1h --no-docker
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { scriptArgs } from './args.ts';
import { realFetch } from './http.ts';
import { Git, realRun } from './proc.ts';
import { Runner } from './runner.ts';
import { checkUat } from './uat-checks.ts';

const { values } = parseArgs({
  args: scriptArgs(),
  options: {
    expect: { type: 'string' },
    since: { type: 'string', default: '15m' },
    hub: { type: 'string', default: 'http://10.100.0.2:4820' },
    site: { type: 'string', default: 'http://10.100.0.2:4810' },
    games: { type: 'string', default: 'http://10.100.0.2:4830' },
    'no-docker': { type: 'boolean', default: false },
  },
});

const runner = new Runner();
try {
  await checkUat(
    {
      hub: values.hub,
      site: values.site,
      games: values.games,
      expect: values.expect,
      since: values.since,
      docker: !values['no-docker'],
    },
    { http: realFetch, git: new Git(), run: realRun, cwd: tmpdir() },
    runner,
  );
  process.exitCode = runner.finish();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
