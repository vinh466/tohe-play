// Game side of the contract. Must stay dependency-free at runtime: only `import type` from @tohe/contract,
// so that a game bundle never pulls in Zod.
import type { GameMessageInput, HostMessage, Profile, Settings } from '@tohe/contract';
import { parentWindowTransport, type Transport } from './transport.ts';

export const SDK_VERSION = '0.1.0';
/** Mirrors PROTOCOL_VERSION in @tohe/contract (asserted by a test). */
export const PROTOCOL = 1;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ConnectOptions {
  /** Must equal `id` in game.json. */
  gameId: string;
  /** How long to wait for the hub's `init` when embedded. Default 5000 ms. */
  timeoutMs?: number;
  /** Override the transport (tests, custom hosts). Defaults to the parent window when embedded. */
  transport?: Transport;
}

export type SessionEvent = 'pause' | 'resume' | 'settings';

export interface GameSession<TSave extends JsonValue = JsonValue> {
  /** `embedded` inside the hub, `standalone` when the game page is opened directly (local dev). */
  readonly mode: 'embedded' | 'standalone';
  readonly profile: Profile;
  readonly locale: string;
  readonly seed: number;
  /** State from the last `save()` for this profile, or null on first play. */
  readonly saved: TSave | null;
  /** Current settings; updated before `settings` listeners run. */
  readonly settings: Settings;
  on(event: 'pause' | 'resume', listener: () => void): () => void;
  on(event: 'settings', listener: (settings: Settings) => void): () => void;
  /** Persist the game state for this profile. Resolves once the hub has stored it. */
  save(data: TSave): Promise<void>;
  /** Record a finished run's score on a leaderboard (default board: `default`). */
  submitScore(value: number, board?: string): Promise<void>;
  /** Ask the hub to close the game. */
  exit(): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
}

type Listener = (payload: Settings) => void;

class Emitter {
  private readonly listeners = new Map<SessionEvent, Set<Listener>>();
  on(event: SessionEvent, listener: Listener): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return () => set.delete(listener);
  }
  emit(event: SessionEvent, payload?: Settings): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload as Settings);
  }
}

/**
 * Connect the game to its host. Inside the hub this performs the ready/init handshake; opened directly
 * it returns a standalone session backed by localStorage so the game can be developed on its own.
 */
export function connect<TSave extends JsonValue = JsonValue>(
  options: ConnectOptions,
): Promise<GameSession<TSave>> {
  const embedded =
    options.transport !== undefined || (typeof window !== 'undefined' && window.parent !== window);
  if (!embedded) return Promise.resolve(standaloneSession<TSave>(options.gameId));
  return embeddedSession<TSave>(options);
}

function embeddedSession<TSave extends JsonValue>(options: ConnectOptions): Promise<GameSession<TSave>> {
  const transport = options.transport ?? parentWindowTransport();
  const emitter = new Emitter();
  const pending = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  let nextId = 0;
  const send = (message: GameMessageInput) => transport.post(message);

  const request = (
    message: { type: 'save'; data: JsonValue } | { type: 'score'; value: number; board: string },
  ) =>
    new Promise<void>((resolve, reject) => {
      const id = `r${++nextId}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${message.type} timed out`));
      }, 10_000);
      pending.set(id, {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      send({ tohe: PROTOCOL, id, ...message });
    });

  return new Promise((resolve, reject) => {
    let session: GameSession<TSave> | null = null;
    let settings: Settings = { muted: false };

    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`no init from host within ${options.timeoutMs ?? 5000} ms`));
    }, options.timeoutMs ?? 5000);

    const unsubscribe = transport.subscribe((raw) => {
      const message = raw as HostMessage;
      if (message?.tohe !== PROTOCOL) return;
      switch (message.type) {
        case 'init': {
          if (session) return;
          clearTimeout(timeout);
          settings = message.settings;
          const created: GameSession<TSave> = {
            mode: 'embedded',
            profile: message.profile,
            locale: message.locale,
            seed: message.seed,
            saved: message.save as TSave | null,
            get settings() {
              return settings;
            },
            on: (event: SessionEvent, listener: Listener) => emitter.on(event, listener),
            save: (data) => request({ type: 'save', data }),
            submitScore: (value, board = 'default') => request({ type: 'score', value, board }),
            exit: () => send({ tohe: PROTOCOL, type: 'exit' }),
            log: (level, text) => send({ tohe: PROTOCOL, type: 'log', level, message: text.slice(0, 2000) }),
          };
          session = created;
          resolve(created);
          return;
        }
        case 'pause':
        case 'resume':
          emitter.emit(message.type);
          return;
        case 'settings':
          settings = message.settings;
          emitter.emit('settings', settings);
          return;
        case 'result': {
          const entry = pending.get(message.replyTo);
          if (!entry) return;
          pending.delete(message.replyTo);
          if (message.ok) entry.resolve();
          else entry.reject(new Error(message.error ?? 'rejected by host'));
          return;
        }
      }
    });

    send({ tohe: PROTOCOL, type: 'ready', gameId: options.gameId, sdkVersion: SDK_VERSION });
  });
}

function standaloneSession<TSave extends JsonValue>(gameId: string): GameSession<TSave> {
  const emitter = new Emitter();
  const key = (suffix: string) => `tohe:standalone:${gameId}:${suffix}`;
  const read = <T>(suffix: string): T | null => {
    const raw = localStorage.getItem(key(suffix));
    return raw === null ? null : (JSON.parse(raw) as T);
  };
  const settings: Settings = { muted: false };

  document.addEventListener('visibilitychange', () => emitter.emit(document.hidden ? 'pause' : 'resume'));

  return {
    mode: 'standalone',
    profile: { id: 'standalone', name: 'Player' },
    locale: navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en',
    seed: Date.now() % 2_147_483_647,
    saved: read<TSave>('save'),
    settings,
    on: (event: SessionEvent, listener: Listener) => emitter.on(event, listener),
    save: async (data) => localStorage.setItem(key('save'), JSON.stringify(data)),
    submitScore: async (value, board = 'default') => {
      const best = read<number>(`best:${board}`);
      if (best === null || value > best) localStorage.setItem(key(`best:${board}`), JSON.stringify(value));
    },
    exit: () => console.info('[tohe] exit() called — ignored in standalone mode'),
    log: (level, message) => console[level](`[tohe] ${message}`),
  };
}
