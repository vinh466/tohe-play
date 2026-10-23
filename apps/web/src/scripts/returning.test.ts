import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import script from './returning.js?raw';

/**
 * Runs the script as a browser would, on a page with `stored` in localStorage; returns whether it marked the page as a
 * returning browser's, and where it went (nowhere, ever: `/` never redirects).
 */
function run(stored: Record<string, string>, storageThrows = false) {
  const moved: string[] = [];
  const attributes = new Map<string, string>();
  const location = {
    pathname: '/',
    search: '',
    replace: (url: string) => moved.push(url),
    assign: (url: string) => moved.push(url),
  };
  const document = {
    documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) },
  };
  const localStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error('blocked');
      return key in stored ? (stored[key] ?? null) : null;
    },
  };
  new Function('location', 'localStorage', 'document', script)(location, localStorage, document);
  return { returning: attributes.has('data-returning'), moved };
}

describe('the returning-player script', () => {
  it('leaves a new visitor’s page as it is', () => {
    expect(run({})).toEqual({ returning: false, moved: [] });
    expect(run({ 'tohe:muted': '1', 'tohe:next': '/play' })).toEqual({ returning: false, moved: [] });
  });

  it('marks the page of a device that has opened a game, so the header shows Chơi tiếp', () => {
    expect(run({ 'tohe:returning': '1' }).returning).toBe(true);
  });

  it('reads only tohe:returning: a guest, or a device the app’s telemetry counted, has not opened a game', () => {
    expect(run({ 'tohe:guest': '1' }).returning).toBe(false);
    expect(run({ 'tohe:telemetry:device': '{"id":"a","since":1}' }).returning).toBe(false);
    expect(script).not.toContain('tohe:guest');
    expect(script).not.toContain('tohe:telemetry');
  });

  it('never sends anyone anywhere: / never redirects (ADR 0046)', () => {
    expect(run({ 'tohe:returning': '1' }).moved).toEqual([]);
    expect(script).not.toMatch(/location\s*\.\s*(replace|assign|href)|location\s*=/);
  });

  it('shows the newcomer’s page when storage is blocked', () => {
    expect(run({ 'tohe:returning': '1' }, true)).toEqual({ returning: false, moved: [] });
  });

  it('reads the key the app writes when a game is opened: the app’s code still names it, and writes it only there', () => {
    const read = (path: string) => readFileSync(new URL(`../../../hub/src/${path}`, import.meta.url), 'utf8');
    expect(read('launcher/recent.ts')).toContain("'tohe:returning'");
    expect(read('main.tsx')).not.toMatch(/setItem\(\s*['"]tohe:returning/);
  });
});
