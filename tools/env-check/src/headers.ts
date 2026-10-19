// What the response headers must say. Pure: they take a header map (names in lower case) and return a verdict.

export type Headers = Record<string, string | undefined>;

/** The seconds in `max-age` of a Strict-Transport-Security value, or null. */
export function hstsMaxAge(value: string | undefined): number | null {
  const match = value?.match(/(?:^|;)\s*max-age\s*=\s*"?(\d+)"?/i);
  return match ? Number(match[1]) : null;
}

/** The directive's value in a Content-Security-Policy, or null if the policy has no such directive. */
export function cspDirective(csp: string | undefined, name: string): string | null {
  for (const part of (csp ?? '').split(';')) {
    const [directive, ...sources] = part.trim().split(/\s+/);
    if (directive?.toLowerCase() === name) return sources.join(' ');
  }
  return null;
}

/** A game's entry page must forbid form submission: `form-action 'none'`. */
export function hasFormActionNone(csp: string | undefined): boolean {
  return cspDirective(csp, 'form-action') === "'none'";
}

/** Is `token` among the comma-separated directives of X-Robots-Tag? */
export function robotsHas(value: string | undefined, token: string): boolean {
  return (value ?? '')
    .toLowerCase()
    .split(',')
    .some((part) => part.trim() === token);
}

/** The security headers of a hub response (ADR 0040): CSP, HSTS for a year, nosniff. Empty when all is well. */
export function hubSecurityProblems(headers: Headers, minHstsSeconds = 31_536_000): string[] {
  const problems: string[] = [];
  if (!headers['content-security-policy']) problems.push('no Content-Security-Policy');
  const maxAge = hstsMaxAge(headers['strict-transport-security']);
  if (maxAge === null) problems.push('no Strict-Transport-Security');
  else if (maxAge < minHstsSeconds) problems.push(`HSTS max-age ${maxAge} is under ${minHstsSeconds}`);
  if (headers['x-content-type-options']?.toLowerCase() !== 'nosniff')
    problems.push('no X-Content-Type-Options: nosniff');
  return problems;
}
