// What UAT answers and logs, on the homelab (docs/guides/uat.md, ADR 0041). Read-only: GET and HEAD, `docker compose
// logs` and one SELECT.
import { sameOrigin, trimSlash } from './args.ts';
import { expectedCommit } from './expect.ts';
import { robotsHas } from './headers.ts';
import { type Fetcher, getJson } from './http.ts';
import type { Git, Run } from './proc.ts';
import { checkDocsHost, checkPublicPages } from './public-checks.ts';
import { assert, clip, type Runner } from './runner.ts';
import { newestMigration, uatVersion } from './versions.ts';

export interface UatOptions {
  hub: string;
  /** The console's own host (ADR 0042). */
  console: string;
  /** The developer docs, at the root of their own host (ADR 0042). */
  docs: string;
  games: string;
  /** A ref whose commit UAT should run; else the newest `uat-` tag. */
  expect?: string;
  /** How far back to read the API log (`docker compose logs --since`). */
  since: string;
  docker: boolean;
}

export interface UatDeps {
  http: Fetcher;
  git: Git;
  run: Run;
  /** Where the docker commands run: any directory without a compose file, so the project is found by its name. */
  cwd?: string;
}

const PROJECT = 'tohe-uat';
const MIGRATIONS_DIR = 'services/api/src/Tohe.Api/Infrastructure/Database/Migrations';
export const BAD_LOG_LINE = /fail:|crit:|Unhandled|Exception/;

/**
 * The console's own host (ADR 0042), as UAT and production serve it past any access proxy: its page at the root, never
 * indexed; its routes ask for the console's own session; the hub's pages are not there.
 */
export async function checkConsolePage(http: Fetcher, consoleUrl: string, r: Runner): Promise<void> {
  await r.check('/ is the console, noindex', async () => {
    const result = await http(`${consoleUrl}/`);
    assert(result.status === 200, `answered ${result.status}`);
    assert(/<title>[^<]*Quản trị[^<]*<\/title>/.test(result.body), "the title does not contain 'Quản trị'");
    assert(result.body.includes('/assets/'), 'the page does not reference /assets/');
    const robots = result.headers['x-robots-tag'];
    assert(robotsHas(robots, 'noindex'), `X-Robots-Tag is '${robots ?? ''}'`);
  });
  await r.check('/api/admin/overview asks for the console session (401)', async () => {
    const result = await http(`${consoleUrl}/api/admin/overview`);
    assert(result.status === 401, `answered ${result.status}`);
  });
  // Nobody signed in is a normal state of a browser, not an error: 204, as the hub's /api/auth/me.
  await r.check('/api/admin/me says nobody is signed in (204)', async () => {
    const result = await http(`${consoleUrl}/api/admin/me`);
    assert(result.status === 204, `answered ${result.status}`);
  });
  await r.check("the hub's pages are not here (/play is a 404)", async () => {
    const result = await http(`${consoleUrl}/play`);
    assert(result.status === 404, `answered ${result.status}`);
  });
}

/** The lines of a log that mean trouble. */
export function badLogLines(log: string): string[] {
  return log.split('\n').filter((line) => BAD_LOG_LINE.test(line));
}

export async function checkUat(options: UatOptions, deps: UatDeps, r: Runner): Promise<void> {
  const { http, git, run } = deps;
  const hub = trimSlash(options.hub);
  const consoleUrl = trimSlash(options.console);
  const docs = trimSlash(options.docs);
  const games = trimSlash(options.games);

  let expected: Awaited<ReturnType<typeof expectedCommit>> = null;
  try {
    expected = await expectedCommit(git, options.expect, 'uat');
  } catch (error) {
    await r.check('expected commit', () => {
      throw error;
    });
  }

  r.section(`UAT ${hub}`);
  await r.check('/api/health', async () => {
    const result = await http(`${hub}/api/health`);
    assert(result.status === 200, `answered ${result.status}`);
    assert(/^healthy$/i.test(result.body.trim()), `body is '${clip(result.body, 40)}'`);
    return 'Healthy';
  });

  const seen: { version?: string } = {};
  await r.check('/api/config', async () => {
    const result = await getJson<{ apiVersion?: string; email?: boolean; registration?: string }>(
      http,
      `${hub}/api/config`,
    );
    assert(result.status === 200, `answered ${result.status}`);
    seen.version = result.json.apiVersion;
    return `version ${result.json.apiVersion} · registration ${result.json.registration} · email ${result.json.email}`;
  });

  if (expected === null && options.expect === undefined) {
    r.warn(
      'expected version',
      "no 'uat-' tag in this repository: only printing the version (git fetch origin --tags, or --expect <ref>)",
    );
  } else if (expected !== null) {
    const want = uatVersion(expected.commit);
    await r.check(`apiVersion is ${want} (${expected.from})`, () => {
      assert(seen.version === want, `apiVersion is ${seen.version}, expected ${want}`);
    });
  }

  // The root is the public home page (ADR 0042); /play is the app's catalog.
  await checkPublicPages(http, hub, r);
  await r.check('hub /play answers 200', async () => {
    const result = await http(`${hub}/play`);
    assert(result.status === 200, `answered ${result.status}`);
  });
  // The console has a host of its own (ADR 0042): nothing of it on the hub's.
  await r.check('hub /admin/ is a 404', async () => {
    const result = await http(`${hub}/admin/`);
    assert(result.status === 404, `answered ${result.status}`);
  });

  r.section(`console ${consoleUrl}`);
  await checkConsolePage(http, consoleUrl, r);

  r.section(`docs ${docs}`);
  await checkDocsHost(http, docs, hub, r);

  r.section(`games ${games}`);
  await r.check('/catalog.json lists games', async () => {
    const result = await getJson<{ games?: unknown[] }>(http, `${games}/catalog.json`);
    assert(result.status === 200, `answered ${result.status}`);
    const count = result.json.games?.length ?? 0;
    assert(count > 0, 'no games');
    return `${count} games`;
  });
  await r.check('/ redirects to the hub, noindex', async () => {
    const result = await http(`${games}/`);
    assert(result.status === 302, `answered ${result.status}`);
    const location = result.headers.location ?? '';
    assert(sameOrigin(location, hub), `redirects to '${location}'`);
    assert(
      robotsHas(result.headers['x-robots-tag'], 'noindex'),
      `X-Robots-Tag is '${result.headers['x-robots-tag'] ?? ''}'`,
    );
    return `302 → ${location}`;
  });

  r.section('docker (tohe-uat)');
  if (!options.docker) {
    r.warn('docker checks', 'skipped (--no-docker)');
    return;
  }
  const docker = (args: string[]) => run('docker', ['compose', '-p', PROJECT, ...args], { cwd: deps.cwd });
  if ((await run('docker', ['compose', 'version'])).code !== 0) {
    r.warn('docker checks', 'skipped: docker compose is not available here');
    return;
  }

  await r.check(`API log since ${options.since} has no fail/crit/exception`, async () => {
    const result = await docker(['logs', '--no-color', '--since', options.since, 'api']);
    assert(result.code === 0, `docker compose logs failed: ${clip(result.stderr, 100)}`);
    const bad = badLogLines(`${result.stdout}\n${result.stderr}`);
    assert(
      bad.length === 0,
      `${bad.length} bad line${bad.length === 1 ? '' : 's'}, first: ${clip(bad[0] ?? '', 140)}`,
    );
  });

  if (expected === null) {
    r.warn('newest migration', 'no expected commit to read the migration files from: skipped');
    return;
  }
  const commit = expected.commit;
  await r.check('the database has the newest migration of the commit', async () => {
    const want = newestMigration(await git.listDir(commit, MIGRATIONS_DIR));
    assert(want !== null, `no migration file in ${MIGRATIONS_DIR} at ${commit.slice(0, 12)}`);
    const result = await docker([
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'tohe',
      '-d',
      'tohe',
      '-At',
      '-c',
      'SELECT max(migration_id) FROM "__EFMigrationsHistory"',
    ]);
    assert(result.code === 0, `psql failed: ${clip(result.stderr, 100)}`);
    const have = result.stdout.trim();
    assert(have === want, `the database has ${have || 'none'}, the commit has ${want}`);
    return want;
  });
}
