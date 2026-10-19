// Command-line handling shared by the three scripts.

/** The script's arguments. `pnpm … -- --flag` hands the `--` on to the script; options come after it. */
export function scriptArgs(): string[] {
  const argv = process.argv.slice(2);
  return argv[0] === '--' ? argv.slice(1) : argv;
}

/** A URL without a trailing slash, so `${base}/path` is always right. */
export function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Both URLs have the same scheme, host and port. */
export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a, b).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
