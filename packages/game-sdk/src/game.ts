// Game side of the contract. Must stay dependency-free at runtime: only `import type` from @tohe/contract,
// so that a game bundle never pulls in Zod.
import type {
  GameMessageInput,
  HostMessage,
  Profile,
  Reaction,
  RoomInfo,
  RoomSeat,
  Settings,
} from '@tohe/contract';
import { createTelemetry, disabledTelemetry, type Telemetry } from './telemetry.ts';
import { parentWindowTransport, type Transport } from './transport.ts';

export const SDK_VERSION = '0.5.0';
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

export interface GameSession<TSave = JsonValue> {
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
  /** Persist the game state (must be JSON-serialisable, max 64 KB). Resolves once the hub has stored it. */
  save(data: TSave): Promise<void>;
  /** Record a finished run's score on a leaderboard (default board: `default`). */
  submitScore(value: number, board?: string): Promise<void>;
  /**
   * A run that lasts across sittings (ADR 0014): `update()` its score as it grows — the household leaderboard shows
   * it as "in progress" — and `finish()` it when the run ends (game over, or the player starts a new game). Use one
   * id per run and keep it in the save.
   */
  run(id: string, board?: string): ScoreRun;
  /** Ask the hub to close the game. */
  exit(): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
  /**
   * Technical telemetry (ADR 0015): uncaught errors are reported by themselves; the kit adds frame times and renderer
   * events when given this object. A no-op when the hub does not collect telemetry, and in standalone mode.
   */
  readonly telemetry: Telemetry;
  /**
   * The table this game was opened at (online rooms, ADR 0016), or null when it plays on its own. The server
   * referees: the game sends actions and draws the views it receives.
   */
  readonly room: RoomSession | null;
}

/** One view of the table for this seat, with what happened since the last one. */
export interface RoomUpdate<TView = JsonValue> {
  view: TView;
  /** Public events since the previous view, to animate; empty after a (re)connection: redraw from the view. */
  events: JsonValue[];
  seq: number;
  /** Milliseconds left on the turn timer, or null. */
  turnMs: number | null;
}

export interface RoomSession<TView = JsonValue> {
  readonly id: string;
  /** The seat this phone plays, or -1 for a spectator. */
  readonly seat: number;
  /** Players and bots at the table; updated before `seats` listeners run. */
  readonly seats: RoomSeat[];
  /** The room's game options (house rules), as declared in game.json's `rooms.options`. */
  readonly options: Record<string, JsonValue>;
  /** The newest view, or null before the first one arrives. */
  readonly latest: RoomUpdate<TView> | null;
  onView(listener: (update: RoomUpdate<TView>) => void): () => void;
  onSeats(listener: (seats: RoomSeat[]) => void): () => void;
  onReaction(listener: (seat: number, reaction: Reaction) => void): () => void;
  /** Sends an action to the referee; rejects with the rules' error code (e.g. `must_beat`) if refused. */
  act(action: JsonValue): Promise<void>;
  /** The player is ready for the next hand. */
  next(): Promise<void>;
  /** One of the preset reactions (no typed text). */
  react(reaction: Reaction): void;
}

export interface ScoreRun {
  update(value: number): Promise<void>;
  finish(value: number): Promise<void>;
}

type Listener = (payload: Settings) => void;

/** Settings as the game sees them: complete even if a host leaves a field out (an older hub sends no theme). */
export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  return { muted: raw?.muted === true, theme: raw?.theme === 'dark' ? 'dark' : 'light' };
}

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
export function connect<TSave = JsonValue>(options: ConnectOptions): Promise<GameSession<TSave>> {
  const embedded =
    options.transport !== undefined || (typeof window !== 'undefined' && window.parent !== window);
  if (!embedded) return Promise.resolve(standaloneSession<TSave>(options.gameId));
  return embeddedSession<TSave>(options);
}

function embeddedSession<TSave>(options: ConnectOptions): Promise<GameSession<TSave>> {
  const transport = options.transport ?? parentWindowTransport();
  const emitter = new Emitter();
  const pending = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  let nextId = 0;
  const send = (message: GameMessageInput) => transport.post(message);

  const request = (
    message:
      | { type: 'save'; data: JsonValue }
      | { type: 'score'; value: number; board: string; run?: string; final?: boolean }
      | { type: 'room.act'; action: JsonValue }
      | { type: 'room.next' },
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
    let room: ReturnType<typeof roomSession> | null = null;
    let settings = normalizeSettings(undefined);
    let telemetry: Telemetry = disabledTelemetry;

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
          settings = normalizeSettings(message.settings);
          telemetry = message.telemetry
            ? createTelemetry({ send: (events) => send({ tohe: PROTOCOL, type: 'telemetry', events }) })
            : disabledTelemetry;
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
            save: (data) => request({ type: 'save', data: data as JsonValue }),
            submitScore: (value, board = 'default') => request({ type: 'score', value, board }),
            run: (run, board = 'default') => ({
              update: (value) => request({ type: 'score', value, board, run, final: false }),
              finish: (value) => request({ type: 'score', value, board, run, final: true }),
            }),
            exit: () => {
              telemetry.flush();
              send({ tohe: PROTOCOL, type: 'exit' });
            },
            log: (level, text) => send({ tohe: PROTOCOL, type: 'log', level, message: text.slice(0, 2000) }),
            telemetry,
            room: null,
          };
          if (message.room) {
            room = roomSession(message.room, {
              act: (action) => request({ type: 'room.act', action }),
              next: () => request({ type: 'room.next' }),
              react: (reaction) => send({ tohe: PROTOCOL, type: 'room.react', reaction }),
            });
            Object.assign(created, { room: room.session });
          }
          session = created;
          resolve(created);
          return;
        }
        case 'pause':
        case 'resume':
          emitter.emit(message.type);
          // After the game's own pause handlers, so what they report (the kit's frame summary) goes out too.
          if (message.type === 'pause') setTimeout(() => telemetry.flush());
          return;
        case 'settings':
          settings = normalizeSettings(message.settings);
          emitter.emit('settings', settings);
          return;
        case 'room.view':
          room?.view({
            view: message.view,
            events: message.events,
            seq: message.seq,
            turnMs: message.turnMs,
          });
          return;
        case 'room.seats':
          room?.seats(message.seats);
          return;
        case 'room.reaction':
          room?.reaction(message.seat, message.reaction);
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

/** The game's side of a table: keeps the newest view (it may arrive before the game listens) and the seats. */
function roomSession(
  info: RoomInfo,
  send: { act(action: JsonValue): Promise<void>; next(): Promise<void>; react(reaction: Reaction): void },
) {
  const views = new Set<(update: RoomUpdate) => void>();
  const seatListeners = new Set<(seats: RoomSeat[]) => void>();
  const reactions = new Set<(seat: number, reaction: Reaction) => void>();
  let latest: RoomUpdate | null = null;
  let seats = info.seats;
  const subscribe = <T>(set: Set<T>, listener: T) => {
    set.add(listener);
    return () => set.delete(listener);
  };
  const session: RoomSession = {
    id: info.id,
    seat: info.seat,
    get seats() {
      return seats;
    },
    options: info.options as Record<string, JsonValue>,
    get latest() {
      return latest;
    },
    onView: (listener) => subscribe(views, listener),
    onSeats: (listener) => subscribe(seatListeners, listener),
    onReaction: (listener) => subscribe(reactions, listener),
    act: send.act,
    next: send.next,
    react: send.react,
  };
  return {
    session,
    view(update: RoomUpdate) {
      // A view older than the newest one (a late delivery) is dropped.
      if (latest && update.seq < latest.seq) return;
      latest = update;
      for (const listener of views) listener(update);
    },
    seats(next: RoomSeat[]) {
      seats = next;
      for (const listener of seatListeners) listener(next);
    },
    reaction(seat: number, reaction: Reaction) {
      for (const listener of reactions) listener(seat, reaction);
    },
  };
}

function standaloneSession<TSave>(gameId: string): GameSession<TSave> {
  const emitter = new Emitter();
  const key = (suffix: string) => `tohe:standalone:${gameId}:${suffix}`;
  const read = <T>(suffix: string): T | null => {
    const raw = localStorage.getItem(key(suffix));
    return raw === null ? null : (JSON.parse(raw) as T);
  };
  const keepBest = (value: number, board: string) => {
    const best = read<number>(`best:${board}`);
    if (best === null || value > best) localStorage.setItem(key(`best:${board}`), JSON.stringify(value));
  };

  // Without a hub, the theme follows the device's light/dark setting, live.
  const device = window.matchMedia('(prefers-color-scheme: dark)');
  let settings = normalizeSettings({ muted: false, theme: device.matches ? 'dark' : 'light' });
  device.addEventListener('change', () => {
    settings = normalizeSettings({ ...settings, theme: device.matches ? 'dark' : 'light' });
    emitter.emit('settings', settings);
  });

  document.addEventListener('visibilitychange', () => emitter.emit(document.hidden ? 'pause' : 'resume'));

  return {
    mode: 'standalone',
    profile: { id: 'standalone', name: 'Player' },
    locale: navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en',
    seed: Date.now() % 2_147_483_647,
    saved: read<TSave>('save'),
    get settings() {
      return settings;
    },
    on: (event: SessionEvent, listener: Listener) => emitter.on(event, listener),
    save: async (data) => localStorage.setItem(key('save'), JSON.stringify(data)),
    submitScore: async (value, board = 'default') => keepBest(value, board),
    run: (_run, board = 'default') => ({
      update: async (value) => keepBest(value, board),
      finish: async (value) => keepBest(value, board),
    }),
    exit: () => console.info('[tohe] exit() called — ignored in standalone mode'),
    log: (level, message) => console[level](`[tohe] ${message}`),
    telemetry: disabledTelemetry,
    room: null,
  };
}
