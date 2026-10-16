// Where to go after signing in and choosing a profile, for links that need a player first (a room link, /r/<code>).
// Kept in sessionStorage so it survives registering, signing in and the profile picker; only paths of this hub.
const KEY = 'tohe:next';

/** A path on this hub ("/r/482913"), never another site ("//evil", "https://…"). */
export const isLocalPath = (path: string) => /^\/(?!\/)[\w\-./?=&%]*$/.test(path);

export function rememberNext(path: string) {
  if (isLocalPath(path)) sessionStorage.setItem(KEY, path);
}

/** The remembered path, once. */
export function takeNext(): string | null {
  const path = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return path && isLocalPath(path) ? path : null;
}
