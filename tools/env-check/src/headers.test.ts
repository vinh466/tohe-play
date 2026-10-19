import { describe, expect, it } from 'vitest';
import { cspDirective, hasFormActionNone, hstsMaxAge, hubSecurityProblems, robotsHas } from './headers.ts';

describe('hasFormActionNone', () => {
  it("accepts form-action 'none' among other directives", () => {
    expect(
      hasFormActionNone("default-src 'self'; form-action 'none'; frame-ancestors https://toheplay.io.vn"),
    ).toBe(true);
  });

  it('rejects a missing or a looser form-action', () => {
    expect(hasFormActionNone("default-src 'self'")).toBe(false);
    expect(hasFormActionNone("form-action 'self'")).toBe(false);
    expect(hasFormActionNone("form-action 'none' https://evil.test")).toBe(false);
    expect(hasFormActionNone(undefined)).toBe(false);
  });

  it('does not mistake a source for a directive', () => {
    expect(hasFormActionNone("default-src 'self' form-action 'none'")).toBe(false);
  });
});

describe('cspDirective', () => {
  it('returns the sources of a directive, case-insensitively', () => {
    expect(cspDirective("Default-Src 'self' data:; img-src *", 'default-src')).toBe("'self' data:");
    expect(cspDirective("default-src 'self'", 'img-src')).toBeNull();
  });
});

describe('hstsMaxAge', () => {
  it('reads max-age', () => {
    expect(hstsMaxAge('max-age=31536000; includeSubDomains; preload')).toBe(31_536_000);
    expect(hstsMaxAge('includeSubDomains; max-age=60')).toBe(60);
  });

  it('is null without max-age', () => {
    expect(hstsMaxAge('includeSubDomains')).toBeNull();
    expect(hstsMaxAge(undefined)).toBeNull();
  });
});

describe('robotsHas', () => {
  it('finds a directive in the list', () => {
    expect(robotsHas('noindex, nofollow', 'nofollow')).toBe(true);
    expect(robotsHas('NOINDEX', 'noindex')).toBe(true);
    expect(robotsHas('noindex', 'nofollow')).toBe(false);
    expect(robotsHas(undefined, 'noindex')).toBe(false);
  });
});

describe('hubSecurityProblems', () => {
  const good = {
    'content-security-policy': "default-src 'self'",
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
  };

  it('has nothing to say about a good response', () => {
    expect(hubSecurityProblems(good)).toEqual([]);
  });

  it('names every missing header', () => {
    expect(hubSecurityProblems({})).toEqual([
      'no Content-Security-Policy',
      'no Strict-Transport-Security',
      'no X-Content-Type-Options: nosniff',
    ]);
  });

  it('rejects a short HSTS max-age', () => {
    expect(hubSecurityProblems({ ...good, 'strict-transport-security': 'max-age=300' })).toEqual([
      'HSTS max-age 300 is under 31536000',
    ]);
  });
});
