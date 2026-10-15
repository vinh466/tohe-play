import type { Telemetry } from '@tohe/game-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSfx } from './sfx.ts';

/** Like iOS: the context only starts when resumed during a user activation. */
let activation = false;

const param = () => ({
  value: 0,
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
  setTargetAtTime() {},
});
const node = () => ({
  gain: param(),
  frequency: param(),
  buffer: null,
  connect: (next: unknown) => next,
  start() {},
  stop() {},
});

class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  state: string = 'suspended';
  readonly sampleRate = 48_000;
  readonly currentTime = 0;
  readonly destination = {};
  constructor() {
    FakeAudioContext.last = this;
  }
  resume() {
    if (!activation) return Promise.reject(new Error('NotAllowedError'));
    this.state = 'running';
    return Promise.resolve();
  }
  createGain = node;
  createOscillator = node;
  createBufferSource = node;
  createBuffer() {
    return {};
  }
}

function fire(type: string, pointerType?: string) {
  activation = !(type === 'pointerdown' && pointerType !== 'mouse');
  window.dispatchEvent(Object.assign(new Event(type), pointerType ? { pointerType } : {}));
  activation = false;
}

/** A finger landing and lifting, as the browser reports it. */
function tap() {
  fire('pointerdown', 'touch');
  fire('pointerup', 'touch');
  fire('touchend');
  fire('click');
}

function fakeTelemetry() {
  return { enabled: true, count: vi.fn(), metric: vi.fn(), error: vi.fn(), frames: vi.fn(), flush: vi.fn() };
}

describe('createSfx', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('AudioContext', FakeAudioContext);
    FakeAudioContext.last = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts the sound when the finger lifts, not when it lands', () => {
    createSfx();
    fire('pointerdown', 'touch');
    expect(FakeAudioContext.last?.state).toBe('suspended');
    fire('pointerup', 'touch');
    expect(FakeAudioContext.last?.state).toBe('running');
  });

  it('brings the sound back with the next tap after iOS interrupted it', async () => {
    const sfx = createSfx();
    tap();
    const audio = FakeAudioContext.last as FakeAudioContext;
    audio.state = 'interrupted';
    sfx.play('merge', 3); // from a tween: refused quietly, no unhandled rejection
    await vi.runAllTimersAsync();
    expect(audio.state).toBe('interrupted');
    tap();
    expect(audio.state).toBe('running');
  });

  it('reports sound still off a second after the first tap, once', () => {
    const telemetry = fakeTelemetry();
    createSfx({ telemetry: telemetry as Telemetry });
    vi.spyOn(FakeAudioContext.prototype, 'resume').mockReturnValue(Promise.resolve()); // never starts
    fire('pointerdown', 'touch');
    vi.advanceTimersByTime(2000); // the finger is still down: nothing to judge yet
    expect(telemetry.count).not.toHaveBeenCalled();
    fire('pointerup', 'touch');
    tap();
    vi.advanceTimersByTime(1000);
    expect(telemetry.count).toHaveBeenCalledTimes(1);
    expect(telemetry.count).toHaveBeenCalledWith('kit.audio.blocked');
  });

  it('reports nothing when the sound started', () => {
    const telemetry = fakeTelemetry();
    createSfx({ telemetry: telemetry as Telemetry });
    tap();
    vi.advanceTimersByTime(1000);
    expect(telemetry.count).not.toHaveBeenCalled();
  });

  it('reports a browser without Web Audio once', () => {
    vi.stubGlobal('AudioContext', undefined);
    const telemetry = fakeTelemetry();
    createSfx({ telemetry: telemetry as Telemetry });
    tap();
    tap();
    expect(telemetry.count).toHaveBeenCalledTimes(1);
    expect(telemetry.count).toHaveBeenCalledWith('kit.audio.unsupported');
  });
});
