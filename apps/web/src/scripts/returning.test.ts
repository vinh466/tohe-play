import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import script from './returning.js?raw';

/** Runs the script as a browser would, on a page at `search` with `stored` in localStorage; returns where it went. */
function run(search: string, stored: Record<string, string>, storageThrows = false): string[] {
  const moved: string[] = [];
  const location = { search, replace: (url: string) => moved.push(url) };
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

  it('reads the keys the app writes: the app’s code still names them', () => {
    const read = (path: string) => readFileSync(new URL(`../../../hub/src/${path}`, import.meta.url), 'utf8');
    expect(read('main.tsx')).toContain("'tohe:returning'");
    expect(read('session/session.ts')).toContain("'tohe:guest'");
    expect(read('telemetry/collector.ts')).toContain("'tohe:telemetry:device'");
  });
});
