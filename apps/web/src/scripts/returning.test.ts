import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import script from './returning.js?raw';

/**
 * Runs the script as a browser would, on the page at `pathname` with the query `search` and `stored` in localStorage;
 * returns where it went.
 */
function run(
  search: string,
  stored: Record<string, string>,
  storageThrows = false,
  pathname = '/',
): string[] {
  const moved: string[] = [];
  const location = { pathname, search, replace: (url: string) => moved.push(url) };
  const localStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error('blocked');
      return key in stored ? (stored[key] ?? null) : null;
    },
  };
  new Function('location', 'localStorage', script)(location, localStorage);
  return moved;
}

describe('the returning-player script', () => {
  it('leaves a new visitor on the page', () => {
    expect(run('', {})).toEqual([]);
    expect(run('?utm_source=x', { 'tohe:muted': '1', 'tohe:next': '/play' })).toEqual([]);
  });

  it('sends a guest, and a device the app has counted, to the app', () => {
    expect(run('', { 'tohe:returning': '1' })).toEqual(['/play']);
    expect(run('', { 'tohe:guest': '1' })).toEqual(['/play']);
    expect(run('', { 'tohe:telemetry:device': '{"id":"a","since":1}' })).toEqual(['/play']);
    expect(run('?utm_source=x', { 'tohe:guest': '1' })).toEqual(['/play']);
  });

  it.each(['?stay', '?stay=1', '?a=1&stay', '?stay=false'])('never redirects on %s', (search) => {
    expect(run(search, { 'tohe:guest': '1', 'tohe:telemetry:device': '{}' })).toEqual([]);
  });

  it('shows the page when storage is blocked', () => {
    expect(run('', { 'tohe:guest': '1' }, true)).toEqual([]);
  });

  // The English home page does the same, and opens the app in English, as every link of an English page does.
  describe('on /en/', () => {
    const onEnglish = (search: string, stored: Record<string, string>, storageThrows = false) =>
      run(search, stored, storageThrows, '/en/');

    it('leaves a new visitor on the page', () => {
      expect(onEnglish('', {})).toEqual([]);
    });

    it('sends a device that has played to the app, in English', () => {
      expect(onEnglish('', { 'tohe:returning': '1' })).toEqual(['/play?lang=en']);
      expect(onEnglish('', { 'tohe:guest': '1' })).toEqual(['/play?lang=en']);
      expect(onEnglish('?utm_source=x', { 'tohe:telemetry:device': '{}' })).toEqual(['/play?lang=en']);
    });

    it.each(['?stay', '?stay=1'])('never redirects on %s', (search) => {
      expect(onEnglish(search, { 'tohe:guest': '1' })).toEqual([]);
    });

    it('shows the page when storage is blocked', () => {
      expect(onEnglish('', { 'tohe:guest': '1' }, true)).toEqual([]);
    });

    it('treats only /en and what lies under it as English', () => {
      expect(run('', { 'tohe:guest': '1' }, false, '/en')).toEqual(['/play?lang=en']);
      expect(run('', { 'tohe:guest': '1' }, false, '/english/')).toEqual(['/play']);
    });
  });

  it('reads the keys the app writes: the app’s code still names them', () => {
    const read = (path: string) => readFileSync(new URL(`../../../hub/src/${path}`, import.meta.url), 'utf8');
    expect(read('main.tsx')).toContain("'tohe:returning'");
    expect(read('session/session.ts')).toContain("'tohe:guest'");
    expect(read('telemetry/collector.ts')).toContain("'tohe:telemetry:device'");
  });
});
