// The three scripts' checks against fakes: no network, no git, no docker.
import { describe, expect, it } from 'vitest';
import type { Fetcher, HttpResult } from './http.ts';
import { Git, type Run } from './proc.ts';
import { checkProd } from './prod-checks.ts';
import { checkRelease } from './release-checks.ts';
import { Runner } from './runner.ts';

const COMMIT = 'd68554779ed2322ec4f06b3267dc2ac6e7062100';

const html = (body: string, headers: Record<string, string> = {}): HttpResult => ({
  status: 200,
  headers,
  body,
});
const redirect = (status: number, location: string, headers: Record<string, string> = {}): HttpResult => ({
  status,
  headers: { location, ...headers },
  body: '',
});
const json = (value: unknown): HttpResult => html(JSON.stringify(value));

/** A fake git: the answers to the commands the checks run, by their arguments. */
function fakeGit(answers: Record<string, string | number>): Git {
  const run: Run = async (_command, args) => {
    const answer = answers[args.join(' ')];
    if (answer === undefined) return { code: 1, stderr: 'unknown', stdout: '' };
    return typeof answer === 'number'
      ? { code: answer, stderr: '', stdout: '' }
      : { code: 0, stderr: '', stdout: `${answer}\n` };
  };
  return new Git(run);
}

function capture() {
  const lines: string[] = [];
  return { lines, runner: new Runner((line) => lines.push(line)) };
}

const secureHeaders = {
  'content-security-policy': "default-src 'self'",
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
};

function prodSite(gameCsp: string): Fetcher {
  const pages: Record<string, HttpResult> = {
    'https://toheplay.io.vn/api/health': html('Healthy'),
    'https://toheplay.io.vn/api/config': json({
      apiVersion: `sha-${COMMIT}`,
      registration: 'open',
      proofOfWork: false,
      providers: [],
      email: true,
    }),
    'https://toheplay.io.vn/play': html('<html>', secureHeaders),
    'http://toheplay.io.vn/': redirect(301, 'https://toheplay.io.vn/'),
    'https://www.toheplay.io.vn/x': redirect(301, 'https://toheplay.io.vn/x'),
    'https://toheplay.io.vn/admin/': html('<title>Quản trị</title><script src="/admin/assets/a.js">', {
      'x-robots-tag': 'noindex, nofollow',
    }),
    'https://games.toheplay.io.vn/': redirect(302, 'https://toheplay.io.vn', { 'x-robots-tag': 'noindex' }),
    'https://games.toheplay.io.vn/catalog.json': json({ games: [{ id: 'hello' }] }),
    'https://toheplay.io.vn/api/games': json([
      { id: 'hello', entryUrl: 'https://games.toheplay.io.vn/hello/1/index.html' },
    ]),
    'https://games.toheplay.io.vn/hello/1/index.html': html('<html>', { 'content-security-policy': gameCsp }),
    'https://docs.toheplay.io.vn/': html('landing'),
    'https://docs.toheplay.io.vn/docs/': html('docs'),
    'https://docs.toheplay.io.vn/play': redirect(302, 'https://toheplay.io.vn'),
  };
  return async (url) => pages[url] ?? { status: 404, headers: {}, body: '' };
}

const prodOptions = {
  hub: 'https://toheplay.io.vn',
  games: 'https://games.toheplay.io.vn',
  docs: 'https://docs.toheplay.io.vn',
  domain: 'toheplay.io.vn',
  sendingDomain: 'toheplay.io.vn',
  expect: 'prod-2026-10-19.1',
  dns: false,
};
const prodGit = fakeGit({ 'rev-parse --verify --quiet prod-2026-10-19.1^{commit}': COMMIT });
const noDns = async () => [];

describe('checkProd', () => {
  it('passes against a healthy production', async () => {
    const { runner } = capture();
    await checkProd(
      prodOptions,
      { http: prodSite("default-src 'self'; form-action 'none'"), dns: noDns, git: prodGit },
      runner,
    );
    expect(runner.failed).toBe(0);
    expect(runner.passed).toBeGreaterThan(10);
  });

  it("fails when a game's CSP lacks form-action 'none'", async () => {
    const { runner, lines } = capture();
    await checkProd(prodOptions, { http: prodSite("default-src 'self'"), dns: noDns, git: prodGit }, runner);
    expect(runner.failed).toBe(1);
    expect(lines.join('\n')).toMatch(/✘ the first game's entry.*form-action 'none'/);
    expect(runner.finish()).toBe(1);
  });

  it('fails when production runs another commit than the expected one', async () => {
    const { runner } = capture();
    const git = fakeGit({ 'rev-parse --verify --quiet prod-2026-10-19.1^{commit}': 'a'.repeat(40) });
    await checkProd(prodOptions, { http: prodSite("form-action 'none'"), dns: noDns, git }, runner);
    expect(runner.failed).toBe(1);
  });

  it('only warns, without a ref or a prod- tag', async () => {
    const { runner } = capture();
    const git = fakeGit({ 'tag --list prod-*': '' });
    await checkProd(
      { ...prodOptions, expect: undefined },
      { http: prodSite("form-action 'none'"), dns: noDns, git },
      runner,
    );
    expect(runner.failed).toBe(0);
    expect(runner.warnings).toBe(1);
  });

  it('reads DKIM and the return path at the sending domain, DMARC and MX at the domain', async () => {
    const records: Record<string, string[]> = {
      'TXT resend._domainkey.notify.toheplay.io.vn': ['p=MIGf'],
      'TXT send.notify.toheplay.io.vn': ['v=spf1 include:amazonses.com ~all'],
      'MX send.notify.toheplay.io.vn': ['10 feedback-smtp.example.'],
      'TXT _dmarc.toheplay.io.vn': ['v=DMARC1; p=none;'],
      'MX toheplay.io.vn': ['8 route3.mx.cloudflare.net.'],
    };
    const dns = async (name: string, type: 'TXT' | 'MX') => records[`${type} ${name}`] ?? [];
    const options = { ...prodOptions, dns: true, sendingDomain: 'notify.toheplay.io.vn' };

    const moved = capture();
    await checkProd(options, { http: prodSite("form-action 'none'"), dns, git: prodGit }, moved.runner);
    expect(moved.runner.failed).toBe(0);

    // Still checking the root for the provider's records: they are not there.
    const root = capture();
    await checkProd(
      { ...options, sendingDomain: 'toheplay.io.vn' },
      { http: prodSite("form-action 'none'"), dns, git: prodGit },
      root.runner,
    );
    expect(root.runner.failed).toBe(3);
  });
});

describe('checkRelease', () => {
  const ghcr: Fetcher = async (url) => {
    if (url.startsWith('https://ghcr.io/token')) return json({ token: 't' });
    if (url.startsWith('https://api.github.com/'))
      return json({ workflow_runs: [{ name: 'CI', status: 'completed', conclusion: 'success' }] });
    return { status: 200, headers: {}, body: '' };
  };
  const gitAnswers = {
    'rev-parse --verify --quiet main^{commit}': COMMIT,
    'rev-parse --verify --quiet origin/main': COMMIT,
    [`merge-base --is-ancestor ${COMMIT} origin/main`]: 0,
    [`show ${COMMIT}:deploy/helm/tohe/Chart.yaml`]: 'name: tohe\nversion: 0.1.0\n',
    'tag --list uat-*': 'uat-2026-10-19.1',
    [`tag --points-at ${COMMIT} --list uat-*`]: '',
    'tag --list prod-*': '',
    [`tag --points-at ${COMMIT} --list prod-*`]: '',
  };
  const now = new Date('2026-10-19T05:00:00Z');

  it('accepts a built commit and names the next uat- tag', async () => {
    const { runner, lines } = capture();
    await checkRelease({ ref: 'main', for: 'uat', now }, { http: ghcr, git: fakeGit(gitAnswers) }, runner);
    expect(runner.failed).toBe(0);
    expect(lines.join('\n')).toContain('next tag  uat-2026-10-19.2');
  });

  it('for prod, needs a uat- tag on the commit', async () => {
    const { runner, lines } = capture();
    await checkRelease({ ref: 'main', for: 'prod', now }, { http: ghcr, git: fakeGit(gitAnswers) }, runner);
    expect(runner.failed).toBe(1);
    expect(lines.join('\n')).toMatch(/✘ it carries a uat- tag/);
    const withTag = { ...gitAnswers, [`tag --points-at ${COMMIT} --list uat-*`]: 'uat-2026-10-19.1' };
    const second = capture();
    await checkRelease(
      { ref: 'main', for: 'prod', now },
      { http: ghcr, git: fakeGit(withTag) },
      second.runner,
    );
    expect(second.runner.failed).toBe(0);
    expect(second.lines.join('\n')).toContain('next tag  prod-2026-10-19.1');
  });

  it('fails for a commit that is not on origin/main, or whose images are missing', async () => {
    const off = capture();
    await checkRelease(
      { ref: 'main', for: 'uat', now },
      { http: ghcr, git: fakeGit({ ...gitAnswers, [`merge-base --is-ancestor ${COMMIT} origin/main`]: 1 }) },
      off.runner,
    );
    expect(off.lines.join('\n')).toMatch(/✘ it is on origin\/main/);

    const missing: Fetcher = async (url, init) =>
      init?.method === 'HEAD' ? { status: 404, headers: {}, body: '' } : ghcr(url, init);
    const noImages = capture();
    await checkRelease(
      { ref: 'main', for: 'uat', now },
      { http: missing, git: fakeGit(gitAnswers) },
      noImages.runner,
    );
    expect(noImages.runner.failed).toBe(5);
  });

  it('stops at a ref that is not a commit', async () => {
    const { runner } = capture();
    await checkRelease({ ref: 'nope', for: 'uat', now }, { http: ghcr, git: fakeGit({}) }, runner);
    expect(runner.failed).toBe(1);
    expect(runner.passed).toBe(0);
  });
});
