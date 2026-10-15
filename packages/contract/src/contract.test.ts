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
      themes: ['light'],
      minAge: 0,
      sizeBudgetKb: 3000,
    });
  });

  it('accepts a game with both themes or a dark-only one', () => {
    const base = { id: 'merge', name: 'x', version: '1.0.0', protocol: 1 };
    expect(GameManifest.parse({ ...base, themes: ['light', 'dark'] }).themes).toEqual(['light', 'dark']);
    expect(GameManifest.parse({ ...base, themes: ['dark'] }).themes).toEqual(['dark']);
  });

  it.each([
    ['uppercase id', { id: 'Merge', name: 'x', version: '1.0.0', protocol: 1 }],
    ['bad version', { id: 'merge', name: 'x', version: 'v1', protocol: 1 }],
    ['unknown protocol', { id: 'merge', name: 'x', version: '1.0.0', protocol: 2 }],
    ['unknown field', { id: 'merge', name: 'x', version: '1.0.0', protocol: 1, extra: true }],
    ['unknown theme', { id: 'merge', name: 'x', version: '1.0.0', protocol: 1, themes: ['blue'] }],
    ['no theme', { id: 'merge', name: 'x', version: '1.0.0', protocol: 1, themes: [] }],
  ])('rejects %s', (_label, input) => {
    expect(GameManifest.safeParse(input).success).toBe(false);
  });
});

describe('protocol', () => {
  it('parses a score message and defaults the board and finality', () => {
    const message = GameMessage.parse({ tohe: 1, type: 'score', id: 'r1', value: 42 });
    expect(message).toEqual({ tohe: 1, type: 'score', id: 'r1', value: 42, board: 'default', final: true });
  });

  it('accepts a run reporting its score while it goes on', () => {
    const message = GameMessage.parse({
      tohe: 1,
      type: 'score',
      id: 'r2',
      value: 7,
      run: 'run-1',
      final: false,
    });
    expect(message).toMatchObject({ run: 'run-1', final: false });
    expect(GameMessage.safeParse({ tohe: 1, type: 'score', id: 'r3', value: 7, run: '' }).success).toBe(
      false,
    );
  });

  it('ignores messages without the tohe marker', () => {
    expect(GameMessage.safeParse({ type: 'ready', gameId: 'hello', sdkVersion: '1' }).success).toBe(false);
  });

  it('rejects non-JSON save data', () => {
    expect(GameMessage.safeParse({ tohe: 1, type: 'save', id: 'r1', data: () => 1 }).success).toBe(false);
  });

  it('parses an init message with the hub theme', () => {
    const init = HostMessage.parse({
      tohe: 1,
      type: 'init',
      profile: { id: 'p1', name: 'Bé Na' },
      locale: 'vi',
      settings: { muted: false, theme: 'dark' },
      save: { best: 10 },
      seed: 123,
    });
    expect(init.type === 'init' && init.settings.theme).toBe('dark');
  });

  it('rejects settings without a known theme', () => {
    const settings = (theme: unknown) =>
      HostMessage.safeParse({ tohe: 1, type: 'settings', settings: { muted: false, theme } });
    expect(settings('light').success).toBe(true);
    expect(settings('sepia').success).toBe(false);
    expect(settings(undefined).success).toBe(false);
  });
});

describe('telemetry message', () => {
  const telemetry = (events: unknown) => GameMessage.safeParse({ tohe: 1, type: 'telemetry', events });

  it('accepts the four kinds of event', () => {
    const parsed = telemetry([
      { kind: 'error', message: 'TypeError: x', stack: 'at f (/a.js:1:2)', count: 2 },
      { kind: 'count', name: 'kit.renderer.canvas', count: 1 },
      { kind: 'metric', name: 'kit.first-frame-ms', value: 812 },
      { kind: 'frames', buckets: [100, 4, 2, 1, 0, 0], slowestMs: 48, stepP50Ms: 1.2, renderer: 'webgl' },
    ]);
    expect(parsed.success).toBe(true);
  });

  it('keeps names to identifiers, so no text about a player can ride along', () => {
    expect(telemetry([{ kind: 'count', name: 'Na scored 40', count: 1 }]).success).toBe(false);
    expect(telemetry([{ kind: 'count', name: 'game.Score', count: 1 }]).success).toBe(false);
  });

  it('rejects empty, oversized and malformed batches', () => {
    const many = Array.from({ length: 51 }, () => ({ kind: 'count', name: 'a.b', count: 1 }));
    expect(telemetry([]).success).toBe(false);
    expect(telemetry(many).success).toBe(false);
    expect(telemetry([{ kind: 'frames', buckets: [1, 2], slowestMs: 1 }]).success).toBe(false);
    expect(telemetry([{ kind: 'metric', name: 'a.b-ms', value: -1 }]).success).toBe(false);
  });

  it('lets init say whether telemetry is on, and older hubs leave it out', () => {
    const init = (extra: object) =>
      HostMessage.safeParse({
        tohe: 1,
        type: 'init',
        profile: { id: 'p1', name: 'Na' },
        locale: 'vi',
        settings: { muted: false, theme: 'light' },
        save: null,
        seed: 1,
        ...extra,
      });
    expect(init({}).success).toBe(true);
    expect(init({ telemetry: true }).success).toBe(true);
    expect(init({ telemetry: 'yes' }).success).toBe(false);
  });
});
