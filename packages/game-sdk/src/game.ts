// Game side of the contract. Must stay dependency-free at runtime: only `import type` from @tohe/contract,
// so that a game bundle never pulls in Zod.
import type {
  EntryFrom,
  EntryKind,
  EntryResult,
  GameMessageInput,
  HostCan,
  HostMessage,
  IdentityLevel,
  InitProfile,
  RankedReplay,
  Reaction,
  Replay,
  RequiredLevel,
  RequireReason,
  RoomInfo,
  RoomSeat,
  Settings,
  ShellInfo,
  ShellTarget,
} from '@tohe/contract';
import { createTelemetry, disabledTelemetry, type Telemetry } from './telemetry.ts';
import { parentWindowTransport, type Transport } from './transport.ts';

export const SDK_VERSION = '0.10.0';
/** Mirrors PROTOCOL_VERSION in @tohe/contract (asserted by a test). */
export const PROTOCOL = 1;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Mirrors MAX_ENTRY_PAYLOAD_BYTES in @tohe/contract: an entry's payload, as UTF-8 JSON (ADR 0045). */
export const MAX_ENTRY_PAYLOAD_BYTES = 2048;
/** Mirrors MAX_SHARE_TEXT in @tohe/contract. */
const MAX_SHARE_TEXT = 500;

export interface ConnectOptions {
  /** Must equal `id` in game.json. */
  gameId: string;
  /** How long to wait for the hub's `init` when embedded. Default 5000 ms. */
  timeoutMs?: number;
  /** Override the transport (tests, custom hosts). Defaults to the parent window when embedded. */
  transport?: Transport;
}

export type SessionEvent = 'pause' | 'resume' | 'menu' | 'settings';

export interface GameSession<TSave = JsonValue> {
  /** `embedded` inside the hub, `standalone` when the game page is opened directly (local dev). */
  readonly mode: 'embedded' | 'standalone';
  /**
   * The player: `kind` (SDK 0.10.0) is `device` or `account` (ADR 0043, a child's profile is an account's); absent from
   * older hubs. Updated before a `named` request resolves.
   */
  readonly profile: InitProfile;
  readonly locale: string;
  readonly seed: number;
  /** State from the last `save()` for this profile, or null on first play. */
  readonly saved: TSave | null;
  /** Current settings; updated before `settings` listeners run. */
  readonly settings: Settings;
  /** `menu`: the player pressed Back (ADR 0018) — open the menu, close it, or leave from the main menu. */
  on(event: 'pause' | 'resume' | 'menu', listener: () => void): () => void;
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
  /**
   * A finished hand to replay with the game's own rules module (ADR 0016), or null: set up the hand from `seed`,
   * `options` and `carry`, then play `actions` back, showing `seat`'s view.
   */
  readonly replay: Replay | null;
  /**
   * A ranked run to watch (ADR 0032), or null: start from `seed`, play `moves` back with the game's own logic as its
   * verify module would, and record nothing — no save, no score, no ranked run. Every `ranked` game must show one.
   */
  readonly rankedReplay: RankedReplay | null;
  /** The game shell's side of the hub (ADR 0018), for games that declare `shell`. */
  readonly shell: ShellSession;
  /** Ranked runs (ADR 0030), for games that declare `ranked`: the server deals the seed and replays the moves. */
  readonly ranked: RankedSession;
  /**
   * The entry the game was opened by (ADR 0045), or null: a share link's `payload` — untrusted, anyone can make one —
   * the game's `version` when it was made, and its maker (`from`) when they may be shown. Answer it once, within 3 s.
   * The kit's `createShell` answers for a game that gives it an entry handler.
   */
  readonly entry: SessionEntry | null;
  /** Asking the hub for a higher identity level in the middle of play (ADR 0045). */
  readonly identity: IdentitySession;
  /** The hub answers `share()` in this session: false at a table, in a replay, for a child kept to its account. */
  readonly canShare: boolean;
  /**
   * Asks the hub to share a link that opens this game with `payload` (at most 2 KB as UTF-8 JSON) — its sheet, with
   * `text` as the message when it passes the hub's checks. Resolves once the player sent or copied the link; rejects
   * with `cancelled`, `busy`, `limit`, `offline`, `not_allowed` or `unavailable` (at once when `canShare` is false),
   * or `too_large` before sending. No timeout: a sheet takes as long as the player does.
   */
  share(request: { payload: JsonValue; text?: string; level?: IdentityLevel }): Promise<void>;
}

/** An entry the game was opened by (ADR 0045). */
export interface SessionEntry {
  readonly kind: EntryKind;
  readonly payload: JsonValue;
  /** The game's version when the link was made. */
  readonly version: string;
  /** Who made the link, when the hub may show them; null otherwise. */
  readonly from: EntryFrom | null;
  /**
   * The game's answer, once: `handled` (it opened at the place), `unsupported` (not a kind or a version it opens) or
   * `invalid` (not a payload it accepts). Later calls are ignored.
   */
  answer(result: EntryResult): void;
}

/** A higher identity level, asked of the hub in the middle of play (ADR 0045). */
export interface IdentitySession {
  /** The hub answers `require()` in this session: false at a table, in a replay, and for older hubs. */
  readonly canRequire: boolean;
  /**
   * Shows the hub's own sheet, with its own words for `reason`: the name screen for `named`, the sign-in for
   * `account`. Resolves with the profile once it has the level (`session.profile` is updated first). For `account`, a
   * player who signs in gets the game opened again: this never settles then — save before asking. Rejects with
   * `declined`, `busy` or `unavailable` (at once when `canRequire` is false). No timeout.
   */
  require(level: RequiredLevel, reason: RequireReason): Promise<InitProfile>;
}

/** A ranked run the server opened: its id, and the seed to play it from (ADR 0030). */
export interface RankedRun {
  run: string;
  seed: number;
}

/** Ranked runs (ADR 0030): ask for one as a new game starts, hand in its moves when it ends. */
export interface RankedSession {
  /**
   * A ranked run for a new game — play it from its `seed` and keep every move — or null when the hub cannot open one
   * (offline, a guest, standalone): then play unranked, as before.
   */
  start(): Promise<RankedRun | null>;
  /** The run ended: its moves in order and the score reached. The hub sends them on, or keeps them until it is online. */
  finish(run: string, moves: JsonValue[], score: number): Promise<void>;
}

/** What a `shell` game asks of the hub (ADR 0018). The kit's `createShell` uses it; games rarely call it directly. */
export interface ShellSession {
  /** What the hub can open for this player now. Both false in standalone mode and for older hubs. */
  readonly can: ShellInfo;
  /**
   * The game's menu opened or closed: the answer to the hub's `menu` (Back), so the hub knows the game is alive. The
   * first one also says the game's first screen is up: the hub keeps its loading screen until then (ADR 0019).
   */
  menuChanged(open: boolean): void;
  /** Show the hub's leaderboard for this game over it, or go to the game's rooms lobby. */
  open(what: ShellTarget): void;
  /** The player switched sound in the game: `settings` changes here at once, and the hub remembers it. */
  setMuted(muted: boolean): void;
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
  /** The seat this phone plays, or -1 for a spectator; it can move between hands (updated before `seats` listeners). */
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
/** What `ranked.start` answers with, when the hub opened a run. */
function isRankedRun(value: unknown): value is RankedRun {
  const run = value as Partial<RankedRun> | null;
  return typeof run?.run === 'string' && run.run.length > 0 && Number.isInteger(run.seed);
}

/** A profile, as the hub answers a `named` request with it. */
function isProfile(value: unknown): value is InitProfile {
  const profile = value as Partial<InitProfile> | null;
  return typeof profile?.id === 'string' && typeof profile.name === 'string';
}

/** The bytes of a JSON value as it is sent, UTF-8; Infinity for what is not JSON. */
export function jsonBytes(value: unknown): number {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? Number.POSITIVE_INFINITY : new TextEncoder().encode(text).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** A request the hub cannot answer here: refused at once, as the hub would. */
const refused = (code: string) => Promise.reject(new Error(code));

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
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let nextId = 0;
  const send = (message: GameMessageInput) => transport.post(message);

  const request = (
    message:
      | { type: 'save'; data: JsonValue }
      | { type: 'score'; value: number; board: string; run?: string; final?: boolean }
      | { type: 'room.act'; action: JsonValue }
      | { type: 'room.next' }
      | { type: 'ranked.start' }
      | { type: 'ranked.finish'; run: string; moves: JsonValue[]; score: number }
      | { type: 'identity.require'; level: RequiredLevel; reason: RequireReason }
      | { type: 'share'; payload: JsonValue; text?: string; level?: IdentityLevel },
    // A sheet of the hub takes as long as the player does (ADR 0045): no timeout for those.
    timeoutMs: number | null = 10_000,
  ) =>
    new Promise<unknown>((resolve, reject) => {
      const id = `r${++nextId}`;
      const timer =
        timeoutMs === null
          ? undefined
          : setTimeout(() => {
              pending.delete(id);
              reject(new Error(`${message.type} timed out`));
            }, timeoutMs);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
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
          let profile: InitProfile = message.profile;
          const can: HostCan = message.can ?? { require: false, share: false };
          const created: GameSession<TSave> = {
            mode: 'embedded',
            get profile() {
              return profile;
            },
            locale: message.locale,
            seed: message.seed,
            saved: message.save as TSave | null,
            get settings() {
              return settings;
            },
            on: (event: SessionEvent, listener: Listener) => emitter.on(event, listener),
            save: (data) => request({ type: 'save', data: data as JsonValue }).then(() => undefined),
            submitScore: (value, board = 'default') =>
              request({ type: 'score', value, board }).then(() => undefined),
            run: (run, board = 'default') => ({
              update: (value) =>
                request({ type: 'score', value, board, run, final: false }).then(() => undefined),
              finish: (value) =>
                request({ type: 'score', value, board, run, final: true }).then(() => undefined),
            }),
            exit: () => {
              telemetry.flush();
              send({ tohe: PROTOCOL, type: 'exit' });
            },
            log: (level, text) => send({ tohe: PROTOCOL, type: 'log', level, message: text.slice(0, 2000) }),
            telemetry,
            room: null,
            replay: message.replay ?? null,
            rankedReplay: message.rankedReplay ?? null,
            shell: {
              can: message.shell ?? { leaderboard: false, rooms: false },
              menuChanged: (open) => send({ tohe: PROTOCOL, type: 'menu', open }),
              open: (what) => send({ tohe: PROTOCOL, type: 'open', what }),
              setMuted: (muted) => {
                settings = { ...settings, muted };
                emitter.emit('settings', settings);
                send({ tohe: PROTOCOL, type: 'settings', muted });
              },
            },
            ranked: {
              // Any refusal — offline, a guest, an older hub, a timeout — means: play unranked.
              start: () =>
                request({ type: 'ranked.start' }).then(
                  (value) => (isRankedRun(value) ? value : null),
                  () => null,
                ),
              finish: (run, moves, score) =>
                request({ type: 'ranked.finish', run, moves, score }).then(() => undefined),
            },
            entry: message.entry
              ? sessionEntry(message.entry, (result) => send({ tohe: PROTOCOL, type: 'entry', result }))
              : null,
            identity: {
              canRequire: can.require,
              require: (level, reason) => {
                if (!can.require) return refused('unavailable');
                return request({ type: 'identity.require', level, reason }, null).then((value) => {
                  // A `named` request answers with the profile as it is now: the game sees it before it goes on.
                  if (isProfile(value)) profile = { ...value, kind: value.kind ?? profile.kind };
                  return profile;
                });
              },
            },
            canShare: can.share,
            share: ({ payload, text, level }) => {
              if (!can.share) return refused('unavailable');
              if (jsonBytes(payload) > MAX_ENTRY_PAYLOAD_BYTES) return refused('too_large');
              return request(
                {
                  type: 'share',
                  payload,
                  // An over-long text is left out, not cut (a cut could split a character): the hub uses its words.
                  ...(text === undefined || text.length > MAX_SHARE_TEXT ? {} : { text }),
                  ...(level === undefined ? {} : { level }),
                },
                null,
              ).then(() => undefined);
            },
          };
          if (message.room) {
            room = roomSession(message.room, {
              act: (action) => request({ type: 'room.act', action }).then(() => undefined),
              next: () => request({ type: 'room.next' }).then(() => undefined),
              react: (reaction) => send({ tohe: PROTOCOL, type: 'room.react', reaction }),
            });
            Object.assign(created, { room: room.session });
          }
          session = created;
          resolve(created);
          return;
        }
        case 'menu':
          emitter.emit('menu');
          return;
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
          room?.seats(message.seats, message.seat);
          return;
        case 'room.reaction':
          room?.reaction(message.seat, message.reaction);
          return;
        case 'result': {
          const entry = pending.get(message.replyTo);
          if (!entry) return;
          pending.delete(message.replyTo);
          if (message.ok) entry.resolve(message.value);
          else entry.reject(new Error(message.error ?? 'rejected by host'));
          return;
        }
      }
    });

    send({ tohe: PROTOCOL, type: 'ready', gameId: options.gameId, sdkVersion: SDK_VERSION });
  });
}

/** The entry the game was opened by, answered once. */
function sessionEntry(
  entry: { kind: EntryKind; payload: unknown; version: string; from?: EntryFrom },
  send: (result: EntryResult) => void,
): SessionEntry {
  let answered = false;
  return {
    kind: entry.kind,
    payload: entry.payload as JsonValue,
    version: entry.version,
    from: entry.from ?? null,
    answer: (result) => {
      if (answered) return;
      answered = true;
      send(result);
    },
  };
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
  let seat = info.seat;
  const subscribe = <T>(set: Set<T>, listener: T) => {
    set.add(listener);
    return () => set.delete(listener);
  };
  const session: RoomSession = {
    id: info.id,
    get seat() {
      return seat;
    },
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
    seats(next: RoomSeat[], mine: number) {
      seats = next;
      seat = mine;
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
    replay: null,
    rankedReplay: null,
    shell: {
      can: { leaderboard: false, rooms: false },
      menuChanged: () => {},
      open: (what) =>
        console.info(`[tohe] open("${what}") — the hub's screens are not there in standalone mode`),
      setMuted: (muted) => {
        settings = normalizeSettings({ ...settings, muted });
        emitter.emit('settings', settings);
      },
    },
    // Standalone, nobody deals a seed or replays a run: every run is unranked.
    ranked: {
      start: async () => null,
      finish: async () => {},
    },
    // Standalone, no hub opens the game by a link, signs anyone in or makes a link.
    entry: null,
    identity: { canRequire: false, require: () => refused('unavailable') },
    canShare: false,
    share: () => refused('unavailable'),
  };
}
