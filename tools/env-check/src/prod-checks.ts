// What production answers, from outside (ADR 0040, ADR 0041). GET and HEAD only; DNS over HTTPS.
import { sameOrigin, trimSlash } from './args.ts';
import type { DnsLookup } from './dns.ts';
import { expectedCommit } from './expect.ts';
import { hasFormActionNone, hubSecurityProblems, robotsHas } from './headers.ts';
import { type Fetcher, getJson } from './http.ts';
import type { Git } from './proc.ts';
import { assert, clip, type Runner } from './runner.ts';
import { prodVersion } from './versions.ts';

export interface ProdOptions {
  hub: string;
  games: string;
  docs: string;
  /** The domain whose mail records are checked. */
  domain: string;
  /** A ref whose commit production should run; else the newest `prod-` tag. */
  expect?: string;
  dns: boolean;
}

export interface ProdDeps {
  http: Fetcher;
  dns: DnsLookup;
  git: Git;
}

interface Config {
  apiVersion?: string;
  gamesOrigin?: string;
  email?: boolean;
  registration?: string;
  proofOfWork?: boolean;
  providers?: unknown[];
  passwordSignIn?: boolean;
}

interface GameSummary {
  id: string;
  entryUrl: string;
}

const REDIRECT = [301, 302, 307, 308];

export async function checkProd(options: ProdOptions, deps: ProdDeps, r: Runner): Promise<void> {
  const { http, git } = deps;
  const hub = trimSlash(options.hub);
  const games = trimSlash(options.games);
  const docs = trimSlash(options.docs);

  r.section(`hub ${hub}`);
  await r.check('/api/health', async () => {
    const result = await http(`${hub}/api/health`);
    assert(result.status === 200, `answered ${result.status}`);
    assert(/^healthy$/i.test(result.body.trim()), `body is '${clip(result.body, 40)}'`);
    return 'Healthy';
  });

  let config: Config | undefined;
  await r.check('/api/config', async () => {
    const result = await getJson<Config>(http, `${hub}/api/config`);
    assert(result.status === 200, `answered ${result.status}`);
    config = result.json;
    const c = result.json;
    return `version ${c.apiVersion} · registration ${c.registration} · proofOfWork ${c.proofOfWork} · providers ${JSON.stringify(c.providers)} · email ${c.email}`;
  });

  let expected: Awaited<ReturnType<typeof expectedCommit>> = null;
  try {
    expected = await expectedCommit(git, options.expect, 'prod');
  } catch (error) {
    await r.check('expected version', () => {
      throw error;
    });
  }
  if (expected === null && options.expect === undefined) {
    r.warn(
      'expected version',
      "no 'prod-' tag in this repository: only printing the version (git fetch origin --tags, or --expect <ref>)",
    );
  } else if (expected !== null) {
    const want = prodVersion(expected.commit);
    await r.check(`apiVersion is ${want.slice(0, 16)}… (${expected.from})`, () => {
      assert(config !== undefined, 'no /api/config to read');
      assert(config.apiVersion === want, `apiVersion is ${config.apiVersion}, expected ${want}`);
    });
  }

  // /play, the app's catalog: the root only leads there until the public pages arrive (ADR 0042).
  await r.check('/play answers 200 with CSP, HSTS and nosniff', async () => {
    const result = await http(`${hub}/play`);
    assert(result.status === 200, `answered ${result.status}`);
    const problems = hubSecurityProblems(result.headers);
    assert(problems.length === 0, problems.join('; '));
  });

  const hubUrl = new URL(hub);
  await r.check('http:// redirects to https://', async () => {
    const result = await http(`http://${hubUrl.host}/`);
    assert(REDIRECT.includes(result.status), `answered ${result.status}`);
    const location = result.headers.location ?? '';
    assert(location.startsWith(`https://${hubUrl.host}`), `redirects to '${location}'`);
    return `${result.status} → ${location}`;
  });
  if (hubUrl.hostname.startsWith('www.')) {
    r.warn('www redirect', `the hub host ${hubUrl.hostname} is itself a www host: skipped`);
  } else {
    await r.check('www redirects to the apex', async () => {
      const result = await http(`https://www.${hubUrl.host}/x`);
      assert(result.status === 301, `answered ${result.status}`);
      const location = result.headers.location ?? '';
      assert(sameOrigin(location, hub), `redirects to '${location}'`);
      return `${result.status} → ${location}`;
    });
  }

  await r.check('/admin/ is the console, noindex', async () => {
    const result = await http(`${hub}/admin/`);
    assert(result.status === 200, `answered ${result.status}`);
    assert(/<title>[^<]*Quản trị[^<]*<\/title>/.test(result.body), "the title does not contain 'Quản trị'");
    assert(result.body.includes('/admin/assets/'), 'the page does not reference /admin/assets/');
    const robots = result.headers['x-robots-tag'];
    assert(
      robotsHas(robots, 'noindex') && robotsHas(robots, 'nofollow'),
      `X-Robots-Tag is '${robots ?? ''}'`,
    );
  });

  r.section(`games ${games}`);
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
  await r.check('/catalog.json lists games', async () => {
    const result = await getJson<{ games?: unknown[] }>(http, `${games}/catalog.json`);
    assert(result.status === 200, `answered ${result.status}`);
    const count = result.json.games?.length ?? 0;
    assert(count > 0, 'no games');
    return `${count} games`;
  });
  await r.check("the first game's entry answers 200 with form-action 'none'", async () => {
    const list = await getJson<GameSummary[]>(http, `${hub}/api/games`);
    assert(list.status === 200, `/api/games answered ${list.status}`);
    const first = list.json[0];
    assert(first !== undefined, '/api/games lists no game');
    const entry = await http(first.entryUrl);
    assert(entry.status === 200, `${first.entryUrl} answered ${entry.status}`);
    assert(
      hasFormActionNone(entry.headers['content-security-policy']),
      `CSP has no form-action 'none': ${clip(entry.headers['content-security-policy'] ?? 'no CSP')}`,
    );
    return `${list.json.length} games, ${first.id} ${first.entryUrl}`;
  });

  r.section(`docs ${docs}`);
  for (const path of ['/', '/docs/']) {
    await r.check(`${path} answers 200`, async () => {
      const result = await http(`${docs}${path}`);
      assert(result.status === 200, `answered ${result.status}`);
    });
  }
  await r.check('/play redirects to the hub', async () => {
    const result = await http(`${docs}/play`);
    assert(REDIRECT.includes(result.status), `answered ${result.status}`);
    const location = result.headers.location ?? '';
    assert(sameOrigin(location, hub), `redirects to '${location}'`);
    return `${result.status} → ${location}`;
  });

  if (!options.dns) return;
  r.section(`mail DNS ${options.domain}`);
  const records: { name: string; type: 'TXT' | 'MX'; has?: RegExp }[] = [
    { name: `resend._domainkey.${options.domain}`, type: 'TXT', has: /p=/ },
    { name: `send.${options.domain}`, type: 'TXT', has: /v=spf1/i },
    { name: `send.${options.domain}`, type: 'MX' },
    { name: `_dmarc.${options.domain}`, type: 'TXT', has: /v=DMARC1/i },
    { name: options.domain, type: 'MX' },
  ];
  for (const record of records) {
    await r.check(`${record.name} ${record.type}`, async () => {
      const answers = await deps.dns(record.name, record.type);
      assert(answers.length > 0, 'no record');
      if (record.has)
        assert(
          answers.some((answer) => record.has?.test(answer)),
          `no record matching ${record.has}`,
        );
      return clip(answers[0] ?? '', 70);
    });
  }
}
