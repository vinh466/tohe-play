// The newcomer funnel (docs/architecture/telemetry.md): each step counted at the right moment, once where it says
// "once", and nothing when telemetry is off.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCollector, type KeyValue, type TelemetryBatch } from './telemetry/collector.ts';
import { createFunnel, FUNNEL, FUNNEL_KEY } from './telemetry/funnel.ts';

function memory(): KeyValue & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function setup(consent: boolean | null = true, storage: KeyValue = memory()) {
  const counted: string[] = [];
  const state = { consent, now: Date.parse('2026-10-20T08:00:00Z') };
  const funnel = createFunnel({
    count: (name) => counted.push(name),
    consent: () => state.consent,
    storage,
    now: () => state.now,
  });
  return { funnel, counted, state, storage };
}

describe('steps counted once per device', () => {
  it('counts the first guest start and the first game, then never again', () => {
    const { funnel, counted } = setup();
    funnel.guestStart();
    funnel.guestStart();
    funnel.firstGame();
    funnel.firstGame();
    expect(counted).toEqual(['hub.funnel.guest-start', 'hub.funnel.first-game']);
  });

  it('remembers across page loads: a new funnel on the same storage counts nothing again', () => {
    const first = setup();
    first.funnel.guestStart();
    first.funnel.installOffered('prompt');
    const later = setup(true, first.storage);
    later.funnel.guestStart();
    later.funnel.installOffered('prompt');
    expect(later.counted).toEqual([]);
  });

  it('counts each way of installing once, under its own name', () => {
    const { funnel, counted } = setup();
    for (const variant of ['prompt', 'ios', 'open-in-browser', 'prompt', 'ios', 'open-in-browser'] as const) {
      funnel.installOffered(variant);
    }
    expect(counted).toEqual([
      'hub.funnel.install-offered.prompt',
      'hub.funnel.install-offered.ios',
      'hub.funnel.install-offered.in-app',
    ]);
  });

  it('does not count the generic way, which only the menu shows', () => {
    const { funnel, counted } = setup();
    funnel.installOffered('generic');
    expect(counted).toEqual([]);
  });

  it('keeps nothing but step names and days in the device', () => {
    const { funnel, storage } = setup();
    funnel.guestStart();
    funnel.standaloneOpen();
    expect(JSON.parse(storage.getItem(FUNNEL_KEY) ?? '{}')).toEqual({
      'hub.funnel.guest-start': '2026-10-20',
      'hub.funnel.standalone-open': '2026-10-20',
    });
  });

  it('survives a damaged entry', () => {
    const storage = memory();
    storage.setItem(FUNNEL_KEY, '[1, 2');
    const { funnel, counted } = setup(true, storage);
    funnel.guestStart();
    expect(counted).toEqual(['hub.funnel.guest-start']);
  });

  it('counts nothing it cannot remember (storage blocked)', () => {
    const blocked: KeyValue = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    const { funnel, counted } = setup(true, blocked);
    funnel.guestStart();
    funnel.standaloneOpen();
    funnel.signInOpened();
    expect(counted).toEqual(['hub.funnel.sign-in-opened']);
  });
});

describe('steps counted each time', () => {
  it('counts every install answer, sign-in opening and account created', () => {
    const { funnel, counted } = setup();
    funnel.installAccepted();
    funnel.installDismissed();
    funnel.installDismissed();
    funnel.signInOpened();
    funnel.signInOpened();
    funnel.accountCreated();
    funnel.accountCreated();
    expect(counted).toEqual([
      'hub.funnel.install-accepted',
      'hub.funnel.install-dismissed',
      'hub.funnel.install-dismissed',
      'hub.funnel.sign-in-opened',
      'hub.funnel.sign-in-opened',
      'hub.funnel.account-created',
      'hub.funnel.account-created',
    ]);
  });
});

describe('the app opened as an installed app', () => {
  it('is counted once a day', () => {
    const { funnel, counted, state } = setup();
    funnel.standaloneOpen();
    state.now += 60 * 60 * 1000;
    funnel.standaloneOpen();
    expect(counted).toEqual(['hub.funnel.standalone-open']);
    state.now = Date.parse('2026-10-21T00:05:00Z');
    funnel.standaloneOpen();
    funnel.standaloneOpen();
    expect(counted).toEqual(['hub.funnel.standalone-open', 'hub.funnel.standalone-open']);
  });
});

describe('coming back in a browser tab (ADR 0046)', () => {
  it('is counted once a day, under its own name, beside the installed app’s', () => {
    const { funnel, counted, state } = setup();
    funnel.browserReturn();
    funnel.browserReturn();
    funnel.standaloneOpen();
    expect(counted).toEqual(['hub.funnel.browser-return', 'hub.funnel.standalone-open']);
    state.now = Date.parse('2026-10-21T09:00:00Z');
    funnel.browserReturn();
    expect(counted).toEqual([
      'hub.funnel.browser-return',
      'hub.funnel.standalone-open',
      'hub.funnel.browser-return',
    ]);
  });
});

describe('with telemetry off', () => {
  it('counts nothing, and does not use up a "once" so that turning telemetry on later still counts it', () => {
    const { funnel, counted, state, storage } = setup(false);
    funnel.guestStart();
    funnel.firstGame();
    funnel.installOffered('ios');
    funnel.installAccepted();
    funnel.installDismissed();
    funnel.signInOpened();
    funnel.accountCreated();
    funnel.standaloneOpen();
    funnel.browserReturn();
    expect(counted).toEqual([]);
    expect(storage.getItem(FUNNEL_KEY)).toBeNull();

    state.consent = true;
    funnel.firstGame();
    expect(counted).toEqual(['hub.funnel.first-game']);
  });

  it('counts while the server switch is not yet known (the collector holds the events until it is)', () => {
    const { funnel, counted } = setup(null);
    funnel.guestStart();
    expect(counted).toEqual(['hub.funnel.guest-start']);
  });
});

describe('through the collector', () => {
  function wired(consent: boolean | null) {
    const storage = memory();
    const sent: TelemetryBatch[] = [];
    const collector = createCollector({
      send: (json) => {
        sent.push(JSON.parse(json) as TelemetryBatch);
        return true;
      },
      online: () => true,
      context: () => ({
        hubVersion: 'test',
        deviceClass: 'phone',
        viewportWidth: 400,
        viewportHeight: 850,
        pixelRatio: 2,
        displayMode: 'browser',
        theme: 'light',
        locale: 'vi',
      }),
      storage,
      now: () => Date.parse('2026-10-20T08:00:00Z'),
      newId: () => 'id',
    });
    collector.setConsent(consent);
    const funnel = createFunnel({
      count: (name) => collector.count(name),
      consent: () => collector.consent,
      storage,
      now: () => Date.parse('2026-10-20T08:00:00Z'),
    });
    return { funnel, collector, sent };
  }

  it('sends hub counts with fixed names and nothing that describes a person', () => {
    const { funnel, collector, sent } = wired(true);
    funnel.guestStart();
    funnel.signInOpened();
    funnel.signInOpened();
    collector.flush();
    const events = sent.flatMap((batch) => batch.events);
    expect(events).toEqual([
      { source: 'hub', kind: 'count', name: FUNNEL.guestStart, count: 1 },
      { source: 'hub', kind: 'count', name: FUNNEL.signInOpened, count: 2 },
    ]);
  });

  it('sends nothing when telemetry is off, and drops what waited for the answer if it turns out to be no', () => {
    const off = wired(false);
    off.funnel.guestStart();
    off.funnel.accountCreated();
    off.collector.flush();
    expect(off.sent).toEqual([]);

    const waiting = wired(null);
    waiting.funnel.guestStart();
    waiting.collector.setConsent(false);
    waiting.collector.flush();
    expect(waiting.sent).toEqual([]);
  });

  it('names fit the API rule for event names', () => {
    const names = [
      FUNNEL.guestStart,
      FUNNEL.firstGame,
      ...Object.values(FUNNEL.installOffered),
      FUNNEL.installAccepted,
      FUNNEL.installDismissed,
      FUNNEL.signInOpened,
      FUNNEL.accountCreated,
      FUNNEL.standaloneOpen,
      FUNNEL.browserReturn,
    ];
    for (const name of names) {
      expect(name).toMatch(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+){0,5}$/);
      expect(name.length).toBeLessThanOrEqual(64);
      expect(name.startsWith('hub.funnel.')).toBe(true);
    }
  });
});

describe('the install store tells the funnel what the player answered', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function store() {
    vi.resetModules();
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('localStorage', memory());
    const { installStore } = await import('./install/install.ts');
    const answers: string[] = [];
    installStore.capture({
      accepted: () => answers.push('accepted'),
      dismissed: () => answers.push('dismissed'),
    });
    const offerPrompt = (outcome: 'accepted' | 'dismissed') => {
      const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome }),
      });
      target.dispatchEvent(event);
    };
    return { installStore, answers, offerPrompt };
  }

  it('reports an accepted browser prompt, and only that', async () => {
    const { installStore, answers, offerPrompt } = await store();
    offerPrompt('accepted');
    expect(await installStore.prompt()).toBe('accepted');
    expect(answers).toEqual(['accepted']);
  });

  it('reports a dismissed browser prompt once, not twice', async () => {
    const { installStore, answers, offerPrompt } = await store();
    offerPrompt('dismissed');
    expect(await installStore.prompt()).toBe('dismissed');
    expect(answers).toEqual(['dismissed']);
  });

  it('reports "Bỏ qua" and "Ẩn" (a dismiss) each time, and nothing when no prompt was offered', async () => {
    const { installStore, answers } = await store();
    expect(await installStore.prompt()).toBe('unavailable');
    installStore.dismiss();
    installStore.dismiss();
    expect(answers).toEqual(['dismissed', 'dismissed']);
  });
});
