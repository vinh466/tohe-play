import { describe, expect, it } from 'vitest';
import { GameManifest, GameMessage, HostMessage } from './index.ts';

describe('GameManifest', () => {
  it('applies defaults to a minimal manifest', () => {
    const manifest = GameManifest.parse({
      id: 'merge-block',
      name: 'Merge Block',
      version: '1.0.0',
      protocol: 1,
    });
    expect(manifest).toMatchObject({
      entry: 'index.html',
      orientation: 'portrait',
      capabilities: [],
      minAge: 0,
      sizeBudgetKb: 3000,
    });
  });

  it.each([
    ['uppercase id', { id: 'Merge', name: 'x', version: '1.0.0', protocol: 1 }],
    ['bad version', { id: 'merge', name: 'x', version: 'v1', protocol: 1 }],
    ['unknown protocol', { id: 'merge', name: 'x', version: '1.0.0', protocol: 2 }],
    ['unknown field', { id: 'merge', name: 'x', version: '1.0.0', protocol: 1, extra: true }],
  ])('rejects %s', (_label, input) => {
    expect(GameManifest.safeParse(input).success).toBe(false);
  });
});

describe('protocol', () => {
  it('parses a score message and defaults the board', () => {
    const message = GameMessage.parse({ tohe: 1, type: 'score', id: 'r1', value: 42 });
    expect(message).toEqual({ tohe: 1, type: 'score', id: 'r1', value: 42, board: 'default' });
  });

  it('ignores messages without the tohe marker', () => {
    expect(GameMessage.safeParse({ type: 'ready', gameId: 'hello', sdkVersion: '1' }).success).toBe(false);
  });

  it('rejects non-JSON save data', () => {
    expect(GameMessage.safeParse({ tohe: 1, type: 'save', id: 'r1', data: () => 1 }).success).toBe(false);
  });

  it('parses an init message', () => {
    const init = HostMessage.parse({
      tohe: 1,
      type: 'init',
      profile: { id: 'p1', name: 'Bé Na' },
      locale: 'vi',
      settings: { muted: false },
      save: { best: 10 },
      seed: 123,
    });
    expect(init.type).toBe('init');
  });
});
