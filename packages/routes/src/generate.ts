// What scripts/generate.ts writes, as pure functions of the map so the tests can read them too.
import {
  consoleLinks,
  consoleNamespaces,
  hubLinks,
  hubNamespaces,
  hubRedirects,
  linkPreviewAppQuery,
  linkPreviewBrowsers,
  linkPreviewCrawlers,
  type Namespace,
  publicPages,
  type Redirect,
} from './map.ts';
import { alternation, covers, linkPreviewPattern, redirectPattern, redirectTemplate } from './match.ts';

const header = (comment: string) =>
  [
    `${comment} Generated from @tohe/routes (packages/routes/src/map.ts) by \`pnpm --filter @tohe/routes build\`.`,
    `${comment} Do not edit: change the map and regenerate (ADR 0042, docs/architecture/hosts-and-paths.md).`,
  ].join('\n');

const caddyPaths = (namespace: Namespace): string[] => {
  switch (namespace.match) {
    case 'exact':
      return [namespace.path];
    case 'tree':
      return [namespace.path, `${namespace.path}/*`];
    case 'prefix':
      return [`${namespace.path}*`];
  }
};

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The Caddy matcher that serves a namespace: its component and how it is served, and for static files how long they
 * are cached — `@appPage`, `@appStaticImmutable`, `@apiProxy`…
 */
export function caddyMatcherName(namespace: Namespace): string {
  const cache = namespace.served === 'static' ? capitalise(namespace.cache ?? 'revalidate') : '';
  return `${namespace.component}${capitalise(namespace.served)}${cache}`;
}

/** Named matchers for one site of the hub image's Caddy, one per matcher name, in the map's order. */
export function caddyMatchers(namespaces: readonly Namespace[] = hubNamespaces): Map<string, string[]> {
  const matchers = new Map<string, string[]>();
  for (const namespace of namespaces) {
    // A redirect is answered by a directive of its own (hubRedirectDirectives), not by a handler in Caddyfile.hub.
    if (namespace.served === 'redirect') continue;
    if (namespace.component === 'app' && namespace.served === 'page' && namespace.indexed) {
      // Caddyfile.hub marks every app page noindex; an indexed page needs a matcher of its own there first.
      throw new Error(`${namespace.id}: an indexed app page is not supported by Caddyfile.hub yet`);
    }
    const name = caddyMatcherName(namespace);
    matchers.set(name, [...(matchers.get(name) ?? []), ...caddyPaths(namespace)]);
  }
  return matchers;
}

/**
 * The redirects as Caddy `redir` directives, which run before any `handle` block of the site: the placeholder
 * namespaces (302) and the old paths of the app (301). The query is kept; Caddy drops the `?` when there is none.
 */
export function hubRedirectDirectives(
  namespaces: readonly Namespace[] = hubNamespaces,
  redirects: readonly Redirect[] = hubRedirects,
): string[] {
  const lines: string[] = [];
  for (const namespace of namespaces) {
    if (namespace.served !== 'redirect' || namespace.redirectTo === undefined) continue;
    const name = `${namespace.id}Redirect`;
    lines.push(
      `# ${namespace.path}: ${namespace.note}.`,
      `@${name} path ${namespace.path}`,
      `redir @${name} ${namespace.redirectTo}?{query} 302`,
    );
  }
  if (redirects.length > 0) {
    lines.push(
      '# The app’s old paths, kept for the links in emails already sent: 301 to the new path, the query kept.',
    );
  }
  for (const redirect of redirects) {
    const name = `legacy${capitalise(redirect.id)}`;
    const to = redirectTemplate(redirect, (n) => `{re.${name}.${n}}`);
    lines.push(
      `@${name} path_regexp ${name} ${redirectPattern(redirect)}`,
      `redir @${name} ${to}?{query} 301`,
    );
  }
  return lines;
}

/**
 * Link previews (ADR 0044): a known crawler asking for `/r/<code>` or `/s/<code>` — not sent on from a card already
 * (`?app=`) — is rewritten to the API's card for it, `/api/previews/<r|s>/<code>`, which @apiProxy then passes through
 * like any API answer — never into a template. A `rewrite` runs before every `handle` of the site; people, and any other
 * path, keep the app's page. Also:
 * - `@notLinkPreview`, every other request: Caddyfile.hub gives it the hub's CSP, so the card keeps the API's own, which
 *   allows its one script by hash;
 * - `@linkPreviewPaths`, the previewed namespaces' links: Caddyfile.hub's app page adds `Vary: User-Agent` there, as the
 *   card does, so a cache in front keeps the two answers apart.
 */
export function linkPreviewDirectives(namespaces: readonly Namespace[] = hubNamespaces): string[] {
  const previewed = namespaces.filter((namespace) => namespace.linkPreview);
  if (previewed.length === 0) return [];
  const conditions = (named: boolean) => [
    `path_regexp${named ? ' linkPreview' : ''} ${linkPreviewPattern(namespaces)}`,
    `header_regexp${named ? ' linkPreviewCrawler' : ''} User-Agent (?i)${alternation(linkPreviewCrawlers)}`,
    `not header_regexp${named ? ' linkPreviewBrowser' : ''} User-Agent (?i)${alternation(linkPreviewBrowsers)}`,
    `not query ${linkPreviewAppQuery}=*`,
  ];
  return [
    '# Link previews: a crawler asking for a link of a previewed namespace gets the API’s card for it; people the app.',
    '@linkPreview {',
    ...conditions(true).map((line) => `\t${line}`),
    '}',
    'rewrite @linkPreview /api/previews/{re.linkPreview.1}/{re.linkPreview.2}',
    '# Every other request: the hub’s CSP (the card keeps its own).',
    '@notLinkPreview {',
    '\tnot {',
    ...conditions(false).map((line) => `\t\t${line}`),
    '\t}',
    '}',
    '# The previewed links, whoever asks: the answer varies with the User-Agent.',
    `@linkPreviewPaths path ${previewed.map((namespace) => `${namespace.path}/*`).join(' ')}`,
  ];
}

/** deploy/docker/hub-routes.caddy, imported by Caddyfile.hub inside its site block. */
export function hubCaddySnippet(
  namespaces: readonly Namespace[] = hubNamespaces,
  redirects: readonly Redirect[] = hubRedirects,
): string {
  const lines = [
    header('#'),
    '# The namespaces of the hub’s host as named matchers; Caddyfile.hub serves each and answers 404 to the rest.',
  ];
  for (const [name, paths] of caddyMatchers(namespaces)) {
    lines.push(`@${name} path ${paths.join(' ')}`);
  }
  lines.push(...hubRedirectDirectives(namespaces, redirects));
  lines.push(...linkPreviewDirectives(namespaces));
  return `${lines.join('\n')}\n`;
}

/**
 * deploy/docker/console-routes.caddy, imported by Caddyfile.hub inside the console's site block: the console's
 * namespaces as named matchers. The console has no redirects.
 */
export function consoleCaddySnippet(namespaces: readonly Namespace[] = consoleNamespaces): string {
  const lines = [
    header('#'),
    '# The namespaces of the console’s host as named matchers; Caddyfile.hub serves each in the console’s site and answers',
    '# 404 to the rest.',
  ];
  for (const [name, paths] of caddyMatchers(namespaces)) {
    lines.push(`@${name} path ${paths.join(' ')}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The hub's own public URL, which the hub image's Caddy reads when the container starts (one image serves every
 * environment, ADR 0021): robots.txt and the sitemap are Caddy templates that write it where an absolute URL belongs.
 */
export const HUB_URL_ENV = 'TOHE_HUB_URL';

/**
 * What the public pages allow AI services to do with them, in Cloudflare's content-signal syntax: search engines and
 * answers that cite the page may use it, training may not (the owner's choice for now, 2026-10-20).
 */
export const CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=no';

/**
 * apps/hub/public/robots.txt: everything may be crawled but what the map keeps out, the content signals, and where the
 * sitemap is. A Caddy template (the hub's Caddy fills in the sitemap's absolute URL), served as it is by `pnpm dev`,
 * where the line is ignored.
 */
export function robotsTxt(namespaces: readonly Namespace[] = hubNamespaces): string {
  const disallowed = namespaces
    .filter((namespace) => !namespace.crawl)
    .map((namespace) => `Disallow: ${namespace.match === 'tree' ? `${namespace.path}/` : namespace.path}`);
  const sitemap = namespaces.find((namespace) => namespace.id === 'sitemap');
  return `${[
    header('#'),
    '',
    'User-agent: *',
    `Content-Signal: ${CONTENT_SIGNAL}`,
    'Allow: /',
    ...disallowed,
    ...(sitemap ? ['', `Sitemap: {{ env "${HUB_URL_ENV}" }}${sitemap.path}`] : []),
  ].join('\n')}\n`;
}

/**
 * The public pages the sitemap lists: each indexed namespace, one page if it is exact, its pages (`publicPages`, which
 * takes the games' ids) if it is a tree. A tree with no pages listed is refused, and so is a page outside its
 * namespace.
 */
export function sitemapPaths(
  namespaces: readonly Namespace[] = hubNamespaces,
  gameIds: readonly string[] = [],
  pages: Record<string, readonly string[]> = publicPages(gameIds),
): string[] {
  return namespaces
    .filter((namespace) => namespace.indexed)
    .flatMap((namespace) => {
      if (namespace.match === 'exact') return [namespace.path];
      const listed = namespace.match === 'tree' ? pages[namespace.id] : undefined;
      if (listed === undefined || listed.length === 0) {
        throw new Error(
          `${namespace.id}: an indexed ${namespace.match} namespace is not listed in the sitemap yet (publicPages in map.ts)`,
        );
      }
      for (const path of listed) {
        if (!covers(namespace, path)) throw new Error(`${namespace.id}: ${path} is outside the namespace`);
      }
      return [...listed];
    });
}

/**
 * deploy/docker/hub-sitemap.caddy: the snippet `hubSitemap`, which Caddyfile.hub imports at its top level and uses to
 * answer /sitemap.xml. The URLs are absolute, from TOHE_HUB_URL when the container starts; without it the sitemap is a
 * 404 rather than a list of relative URLs, which crawlers reject.
 */
export function hubSitemapCaddySnippet(
  namespaces: readonly Namespace[] = hubNamespaces,
  gameIds: readonly string[] = [],
): string {
  const urls = sitemapPaths(namespaces, gameIds).map(
    (path) => `\t\t  <url><loc>{{ env "${HUB_URL_ENV}" }}${path}</loc></url>`,
  );
  return `${[
    header('#'),
    '# The sitemap: the public pages the map marks as indexed, with absolute URLs from the hub’s own public URL.',
    '(hubSitemap) {',
    `\t@noHubUrl expression \`{env.${HUB_URL_ENV}} == ""\``,
    '\terror @noHubUrl 404',
    '\theader Content-Type "application/xml; charset=utf-8"',
    '\t# The templates directive only touches the types it is told of; its default is HTML and plain text.',
    '\ttemplates {',
    '\t\tmime application/xml',
    '\t}',
    '\trespond <<XML',
    '\t\t<?xml version="1.0" encoding="UTF-8"?>',
    '\t\t<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '\t\t</urlset>',
    '\t\tXML 200',
    '}',
  ].join('\n')}\n`;
}

type Links = Record<string, { path: string; note: string }>;

const csMembers = (links: Links) => {
  const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const members = Object.entries(links).flatMap(([name, link]) => [
    `    /// <summary>${xml(link.note)}.</summary>`,
    `    public const string ${name} = "${link.path}";`,
    '',
  ]);
  members.pop();
  return members;
};

/**
 * services/api/src/Tohe.Api/Infrastructure/HubPaths.g.cs: the hub's pages the API links and redirects to, and the
 * console's paths it names.
 */
export function hubPathsCs(links: Links = hubLinks, console: Links = consoleLinks): string {
  return [
    '// <auto-generated>',
    header('//'),
    '// </auto-generated>',
    '',
    'namespace Tohe.Api.Infrastructure;',
    '',
    '/// <summary>',
    '/// The hub’s pages the API links to in emails and redirects to; a query is added where the page reads one.',
    '/// </summary>',
    'public static class HubPaths',
    '{',
    ...csMembers(links),
    '}',
    '',
    '/// <summary>',
    '/// The console’s paths on its own host (ADR 0042): the page the API names in its log, and its routes.',
    '/// </summary>',
    'public static class ConsolePaths',
    '{',
    ...csMembers(console),
    '}',
    '',
  ].join('\n');
}
