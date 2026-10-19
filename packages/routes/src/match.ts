import { hubNamespaces, type Match, type Namespace } from './map.ts';

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
