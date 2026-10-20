import {
  consoleNamespaces,
  hubNamespaces,
  hubRedirects,
  linkPreviewBrowsers,
  linkPreviewCode,
  linkPreviewCrawlers,
  type Match,
  type Namespace,
  type Redirect,
} from './map.ts';

/** Whether `namespace` covers `pathname` (a URL's path, without its query). */
export function covers(namespace: Namespace, pathname: string): boolean {
  switch (namespace.match) {
    case 'exact':
      return pathname === namespace.path;
    case 'tree':
      return pathname === namespace.path || pathname.startsWith(`${namespace.path}/`);
    case 'prefix':
      return pathname.startsWith(namespace.path);
  }
}

/** The namespace of the hub's host that owns `pathname`, or undefined: the hub answers 404. */
export function matchHubPath(
  pathname: string,
  namespaces: readonly Namespace[] = hubNamespaces,
): Namespace | undefined {
  return namespaces.find((namespace) => covers(namespace, pathname));
}

/** The namespace of the console's host that owns `pathname`, or undefined: the console's site answers 404. */
export function matchConsolePath(pathname: string): Namespace | undefined {
  return matchHubPath(pathname, consoleNamespaces);
}

/** Whether some path belongs to both namespaces. */
export function overlap(a: Namespace, b: Namespace): boolean {
  // An exact path, or the root of a tree, is a path of its own: check it against the other.
  if (a.match !== 'prefix' && covers(b, a.path)) return true;
  if (b.match !== 'prefix' && covers(a, b.path)) return true;
  // What remains: a tree's descendants, or a prefix's paths, meeting the other's.
  const start = (n: Namespace) =>
    n.match === 'tree' ? `${n.path}/` : n.match === 'prefix' ? n.path : undefined;
  const sa = start(a);
  const sb = start(b);
  if (sa === undefined || sb === undefined) return false;
  return sa.startsWith(sb) || sb.startsWith(sa);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What may follow a namespace's path, for Workbox, which tests the path and the query together. */
const followedBy: Record<Match, string> = { exact: '(?:\\?|$)', tree: '(?:[/?]|$)', prefix: '' };

/** The service worker's `navigateFallbackAllowlist`: the namespaces it answers with the app page. */
export function navigationAllowlist(namespaces: readonly Namespace[] = hubNamespaces): RegExp[] {
  return namespaces
    .filter((namespace) => namespace.navigation === 'app-shell')
    .map((namespace) => new RegExp(`^${escapeRegExp(namespace.path)}${followedBy[namespace.match]}`));
}

/**
 * The regular expression (RE2 syntax, which Caddy's `path_regexp` and JavaScript share here) that matches the path of
 * an old address: a `:name` segment is one path segment, a tree also takes what follows. Groups are numbered in order,
 * the tree's rest last.
 */
export function redirectPattern(redirect: Redirect): string {
  const path = redirect.from
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '([^/]+)' : escapeRegExp(segment)))
    .join('/');
  return `^${path}${redirect.tree ? '(/.*)?' : ''}$`;
}

/** The new path of an old address, written with `group(n)` for what the pattern's n-th group captured. */
export function redirectTemplate(redirect: Redirect, group: (n: number) => string): string {
  let n = 0;
  const to = redirect.to.replace(/:\w+/g, () => group(++n));
  return redirect.tree ? `${to}${group(++n)}` : to;
}

/** Where an old path leads (301), or undefined: the hub answers as for any other path. The caller keeps the query. */
export function redirectTarget(
  pathname: string,
  redirects: readonly Redirect[] = hubRedirects,
): string | undefined {
  for (const redirect of redirects) {
    const found = new RegExp(redirectPattern(redirect)).exec(pathname);
    if (found) return redirectTemplate(redirect, (n) => found[n] ?? '');
  }
  return undefined;
}

/** Any of `words`, as one regular expression's alternation (the same text for RE2 in Caddy and for JavaScript). */
export const alternation = (words: readonly string[]) => `(${words.map(escapeRegExp).join('|')})`;

/**
 * The path of a link a crawler gets a card for: `/<namespace>/<code>` of a namespace with `linkPreview` — group 1 the
 * namespace without its slash, group 2 the code.
 */
export function linkPreviewPattern(namespaces: readonly Namespace[] = hubNamespaces): string {
  const paths = namespaces
    .filter((namespace) => namespace.linkPreview)
    .map((namespace) => namespace.path.slice(1));
  return `^/(${paths.map(escapeRegExp).join('|')})/(${linkPreviewCode})$`;
}

/**
 * Whether the hub's Caddy answers this request with the API's card (ADR 0044): a link of a previewed namespace, asked by
 * a known crawler that carries no mark of a person's browser. The generated Caddy matcher does the same.
 */
export function isLinkPreview(pathname: string, userAgent: string): boolean {
  return (
    new RegExp(linkPreviewPattern()).test(pathname) &&
    new RegExp(alternation(linkPreviewCrawlers), 'i').test(userAgent) &&
    !new RegExp(alternation(linkPreviewBrowsers), 'i').test(userAgent)
  );
}
