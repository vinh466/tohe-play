// What the hub's root and the docs host answer (ADR 0042), the same in UAT and production: the root is the public home
// page — indexed, with a CSP of its own that allows no inline script — plus robots.txt and sitemap.xml; the docs host
// answers the docs at its root and moves the old /docs/<page> paths to /<page>. GET only.
import { sameOrigin } from './args.ts';
import { cspDirective, hubSecurityProblems, robotsHas } from './headers.ts';
import type { Fetcher } from './http.ts';
import { assert, clip, type Runner } from './runner.ts';

const REDIRECT = [301, 302, 307, 308];

/** The public home page, robots.txt and sitemap.xml on the hub's host. `hub` has no trailing slash. */
export async function checkPublicPages(http: Fetcher, hub: string, r: Runner): Promise<void> {
  await r.check('/ is the public home page: 200, indexed, "Chơi ngay" leads to /play', async () => {
    const result = await http(`${hub}/`);
    assert(result.status === 200, `answered ${result.status}`);
    assert(
      (result.headers['content-type'] ?? '').startsWith('text/html'),
      `content-type is '${result.headers['content-type'] ?? ''}'`,
    );
    const robots = result.headers['x-robots-tag'];
    assert(robots === undefined || !robotsHas(robots, 'noindex'), `X-Robots-Tag is '${robots ?? ''}'`);
    assert(!/<meta[^>]*name="robots"[^>]*noindex/i.test(result.body), 'the page says noindex');
    assert(!result.body.includes('<div id="root">'), 'this is the app, not the public page');
    assert(
      /<a[^>]*href="\/play"[^>]*>\s*Chơi ngay\s*<\/a>/.test(result.body),
      "no 'Chơi ngay' link to /play",
    );
    const canonical = /<link rel="canonical" href="([^"]*)"/.exec(result.body)?.[1] ?? '';
    assert(sameOrigin(canonical, hub), `canonical link is '${canonical}', not the hub's own URL`);
    assert(
      !result.body.includes('.invalid') && !result.body.includes('[[['),
      'a URL placeholder is left in the page',
    );
    return 'the public page';
  });

  await r.check(
    "/ has its own CSP: scripts and styles from the page's own files, and the security headers",
    async () => {
      const result = await http(`${hub}/`);
      const csp = result.headers['content-security-policy'];
      assert(
        cspDirective(csp, 'script-src') === "'self'",
        `script-src is '${cspDirective(csp, 'script-src')}'`,
      );
      assert(cspDirective(csp, 'style-src') === "'self'", `style-src is '${cspDirective(csp, 'style-src')}'`);
      assert(cspDirective(csp, 'frame-ancestors') === "'none'", 'frame-ancestors is not none');
      assert(!/unsafe-/.test(csp ?? ''), `CSP allows ${clip(csp ?? '')}`);
      const problems = hubSecurityProblems(result.headers);
      assert(problems.length === 0, problems.join('; '));
      return clip(csp ?? '');
    },
  );

  await r.check('/sitemap.xml is XML and lists the home page with an absolute URL', async () => {
    const result = await http(`${hub}/sitemap.xml`);
    assert(result.status === 200, `answered ${result.status}`);
    assert(
      (result.headers['content-type'] ?? '').includes('xml'),
      `content-type is '${result.headers['content-type'] ?? ''}'`,
    );
    assert(result.body.includes('<urlset'), 'no <urlset>');
    assert(result.body.includes(`<loc>${hub}/</loc>`), `no <loc>${hub}/</loc>`);
  });

  await r.check('/robots.txt allows the site and names the sitemap', async () => {
    const result = await http(`${hub}/robots.txt`);
    assert(result.status === 200, `answered ${result.status}`);
    assert(/^Allow: \/$/m.test(result.body), "no 'Allow: /'");
    assert(result.body.includes(`Sitemap: ${hub}/sitemap.xml`), `no 'Sitemap: ${hub}/sitemap.xml'`);
  });
}

/** The developer docs at the root of their host, the old /docs/<page> paths moved, /play on to the hub. */
export async function checkDocsHost(http: Fetcher, docs: string, hub: string, r: Runner): Promise<void> {
  await r.check('/ answers the docs (200)', async () => {
    const result = await http(`${docs}/`);
    assert(result.status === 200, `answered ${result.status}`);
    assert(!result.body.includes('Chơi ngay'), 'this is the public page, not the docs');
  });
  await r.check('/docs/x answers 301 to /x, the query kept', async () => {
    const result = await http(`${docs}/docs/guides/uat/?a=1`);
    assert(result.status === 301, `answered ${result.status}`);
    const location = result.headers.location ?? '';
    assert(
      new URL(location, docs).href === `${docs}/guides/uat/?a=1`,
      `redirects to '${location}', not /guides/uat/?a=1`,
    );
    return `301 → ${location}`;
  });
  await r.check('/play redirects to the hub', async () => {
    const result = await http(`${docs}/play`);
    assert(REDIRECT.includes(result.status), `answered ${result.status}`);
    const location = result.headers.location ?? '';
    assert(sameOrigin(location, hub), `redirects to '${location}'`);
    return `${result.status} → ${location}`;
  });
}
