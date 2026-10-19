// What scripts/generate.ts writes, as pure functions of the map so the tests can read them too.
import {
  consoleLinks,
  consoleNamespaces,
  hubLinks,
  hubNamespaces,
  hubRedirects,
  type Namespace,
  type Redirect,
} from './map.ts';
import { redirectPattern, redirectTemplate } from './match.ts';

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

/** apps/hub/public/robots.txt: everything may be crawled but what the map keeps out. No sitemap until public pages. */
export function robotsTxt(namespaces: readonly Namespace[] = hubNamespaces): string {
  const disallowed = namespaces
    .filter((namespace) => !namespace.crawl)
    .map((namespace) => `Disallow: ${namespace.match === 'tree' ? `${namespace.path}/` : namespace.path}`);
  return `${[header('#'), '', 'User-agent: *', ...disallowed].join('\n')}\n`;
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
