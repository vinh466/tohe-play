import { describe, expect, it } from 'vitest';
import script from './from-app.js?raw';

/** Runs the script as a browser would, on a page with `search` as its query, over a session that already holds `session`. */
function run(search: string, session: Record<string, string> = {}, storageThrows = false) {
  const attributes = new Map<string, string>();
  const kept = { ...session };
  const location = { search };
  const document = {
    documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) },
  };
  const sessionStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error('blocked');
      return key in kept ? (kept[key] ?? null) : null;
    },
    setItem: (key: string, value: string) => {
      if (storageThrows) throw new Error('blocked');
      kept[key] = value;
    },
  };
  new Function('location', 'sessionStorage', 'document', script)(location, sessionStorage, document);
  return { fromApp: attributes.has('data-from-app'), kept };
}

describe('the from-app script', () => {
  it('leaves a page opened from anywhere else as it is: every link shows', () => {
    expect(run('')).toEqual({ fromApp: false, kept: {} });
    expect(run('?lang=vi')).toEqual({ fromApp: false, kept: {} });
    expect(run('?from=docs')).toEqual({ fromApp: false, kept: {} });
  });

  it('marks a page the app opened, and remembers the visit', () => {
    expect(run('?from=app')).toEqual({ fromApp: true, kept: { 'tohe:from-app': '1' } });
    expect(run('?lang=en&from=app').fromApp).toBe(true);
  });

  it('keeps the mark for the pages read next in the same visit, which carry no ?from=app', () => {
    const first = run('?from=app');
    expect(run('', first.kept).fromApp).toBe(true);
    expect(run('?lang=en', first.kept).fromApp).toBe(true);
  });

  it('with session storage blocked, the address alone decides', () => {
    expect(run('?from=app', {}, true).fromApp).toBe(true);
    expect(run('', {}, true).fromApp).toBe(false);
  });
});
