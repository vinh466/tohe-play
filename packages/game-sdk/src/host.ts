// Host side of the contract, used by the hub (and by the conformance kit's fake hub).
// Unlike the game side this validates every message with the Zod schemas from @tohe/contract.
import {
  type EntryResult,
  type GameManifest,
  GameMessage,
  type HostMessage,
  type IdentityLevel,
  type InitPayload,
  type InitProfile,
  jsonBytes,
  MAX_ENTRY_PAYLOAD_BYTES,
  MAX_RANKED_MOVES,
  MAX_SAVE_BYTES,
  PROTOCOL_VERSION,
  type RankedRun,
  type Reaction,
  type RequiredLevel,
  type RequireReason,
  type RoomSeat,
  type Settings,
  type ShellTarget,
  type TelemetryEvent,
} from '@tohe/contract';
import type { JsonValue } from './game.ts';
import type { Transport } from './transport.ts';

export { iframeTransport, memoryTransportPair, type Transport } from './transport.ts';

export interface HostOptions {
  transport: Transport;
  manifest: GameManifest;
  /** Builds the init payload once the game says it is ready. */
  init(): InitPayload | Promise<InitPayload>;
  onSave?(data: JsonValue): void | Promise<void>;
  /** `run` is set for a long run's reports (ADR 0014); `final` is false while it goes on. */
  onScore?(score: { value: number; board: string; run?: string; final: boolean }): void | Promise<void>;
  onExit?(): void;
  onLog?(entry: { level: 'info' | 'warn' | 'error'; message: string }): void;
  /** Telemetry from the game, already validated; only sent when `init` set `telemetry` (ADR 0015). */
  onTelemetry?(events: TelemetryEvent[]): void;
  /**
   * An action at the table (ADR 0016), for the server to referee. Throw an Error whose message is the rules' error
   * code to refuse it; resolve when the server accepted it.
   */
  onRoomAct?(action: JsonValue): void | Promise<void>;
  /** The player is ready for the next hand. */
  onRoomNext?(): void | Promise<void>;
  onRoomReact?(reaction: Reaction): void;
  /** A `shell` game's menu opened or closed (ADR 0018): its answer to `menu()`. */
  onMenu?(open: boolean): void;
  /** A `shell` game asks for the hub's leaderboard over it, or for its rooms lobby. */
  onOpen?(what: ShellTarget): void;
  /** A `shell` game's player switched sound in the game. */
  onSettings?(change: { muted: boolean }): void;
  /**
   * A `ranked` game asks for a ranked run as a new game starts (ADR 0030): resolve with the run the server opened, or
   * throw to refuse — the game then plays unranked. Without it, every request is refused.
   */
  onRankedStart?(): RankedRun | Promise<RankedRun>;
  /** A ranked run ended: its moves and the score the game reached, for the server to replay. */
  onRankedFinish?(finish: { run: string; moves: JsonValue[]; score: number }): void | Promise<void>;
  /** The game's answer to `init.entry` (ADR 0045), once. */
  onEntry?(result: EntryResult): void;
  /**
   * The game asks for a higher identity level (ADR 0045): resolve with the profile once it has it (sent to the game as
   * the result's value), throw an Error whose message is `declined`, `busy` or `unavailable` to refuse, or never settle
   * (the game is opened again after signing in). Only when `init.can.require` was true; otherwise `unavailable`.
   */
  onIdentityRequire?(request: {
    level: RequiredLevel;
    reason: RequireReason;
  }): InitProfile | Promise<InitProfile>;
  /**
   * The game asks to share an `entry` link (ADR 0045): resolve once the player sent or copied it, throw an Error whose
   * message is `cancelled`, `busy`, `limit`, `offline`, `not_allowed` or `unavailable` otherwise. Only when
   * `init.can.share` was true, with a payload of at most 2 KB.
   */
  onShare?(request: { payload: JsonValue; text?: string; level?: IdentityLevel }): void | Promise<void>;
  /** A message that failed validation or broke the protocol. */
  onProtocolError?(error: string, raw: unknown): void;
  /** Rejects `ready` if the game does not say ready in time. Default 10000 ms. */
  readyTimeoutMs?: number;
}

export interface HostHandle {
  /** Resolves after the handshake (game ready + init sent). */
  readonly ready: Promise<void>;
  pause(): void;
  resume(): void;
  setSettings(settings: Settings): void;
  /** The seat's view after a change (rooms, ADR 0016). */
  roomView(update: { view: JsonValue; events: JsonValue[]; seq: number; turnMs: number | null }): void;
  /** The players at the table, and this phone's seat in it. */
  roomSeats(seats: RoomSeat[], seat: number): void;
  roomReaction(seat: number, reaction: Reaction): void;
  /** The player pressed Back: a `shell` game opens or closes its menu, or leaves from its main menu (ADR 0018). */
  menu(): void;
  dispose(): void;
}

const encoder = new TextEncoder();

export function createHost(options: HostOptions): HostHandle {
  const { transport, manifest } = options;
  const can = (capability: GameManifest['capabilities'][number]) =>
    manifest.capabilities.includes(capability);
  const send = (message: HostMessage) => transport.post(message);
  const reply = (replyTo: string, error?: string, value?: JsonValue) =>
    send({ tohe: PROTOCOL_VERSION, type: 'result', replyTo, ok: error === undefined, error, value });
  const fail = (error: string, raw: unknown) => options.onProtocolError?.(error, raw);

  let handshaken = false;
  /** What this session's `init` carried (ADR 0045): an entry to answer, and what the hub answers. */
  let awaitingEntry = false;
  let answers = { require: false, share: false };
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Callers that never await `ready` must not trigger unhandled-rejection noise.
  ready.catch(() => {});
  const timer = setTimeout(
    () => rejectReady(new Error(`game "${manifest.id}" did not send ready`)),
    options.readyTimeoutMs ?? 10_000,
  );

  const handle = async (raw: unknown) => {
    if ((raw as { tohe?: unknown } | null)?.tohe !== PROTOCOL_VERSION) return;
    const parsed = GameMessage.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.message, raw);
    const message = parsed.data;

    if (message.type === 'ready') {
      if (handshaken) return fail('duplicate ready', raw);
      if (message.gameId !== manifest.id)
        return fail(`ready from "${message.gameId}", expected "${manifest.id}"`, raw);
      handshaken = true;
      clearTimeout(timer);
      try {
        const init = admitted(await options.init());
        awaitingEntry = init.entry !== undefined;
        answers = init.can ?? answers;
        send({ tohe: PROTOCOL_VERSION, type: 'init', ...init });
        resolveReady();
      } catch (error) {
        rejectReady(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }
    if (!handshaken) return fail(`${message.type} before ready`, raw);

    switch (message.type) {
      case 'save': {
        if (!can('save')) return reply(message.id, 'capability "save" not declared in game.json');
        if (encoder.encode(JSON.stringify(message.data)).byteLength > MAX_SAVE_BYTES)
          return reply(message.id, `save exceeds ${MAX_SAVE_BYTES} bytes`);
        return settle(message.id, () => options.onSave?.(message.data as JsonValue));
      }
      case 'score': {
        if (!can('scores')) return reply(message.id, 'capability "scores" not declared in game.json');
        return settle(message.id, () =>
          options.onScore?.({
            value: message.value,
            board: message.board,
            run: message.run,
            final: message.final,
          }),
        );
      }
      case 'exit':
        return options.onExit?.();
      case 'log':
        return options.onLog?.({ level: message.level, message: message.message });
      case 'telemetry':
        return options.onTelemetry?.(message.events);
      case 'room.act':
        if (!can('rooms')) return reply(message.id, 'capability "rooms" not declared in game.json');
        return settle(message.id, () => options.onRoomAct?.(message.action as JsonValue));
      case 'room.next':
        if (!can('rooms')) return reply(message.id, 'capability "rooms" not declared in game.json');
        return settle(message.id, () => options.onRoomNext?.());
      case 'room.react':
        if (!can('rooms')) return fail('room.react without the "rooms" capability', raw);
        return options.onRoomReact?.(message.reaction);
      case 'menu':
        if (!can('shell')) return fail('menu without the "shell" capability', raw);
        return options.onMenu?.(message.open);
      case 'open':
        if (!can('shell')) return fail('open without the "shell" capability', raw);
        return options.onOpen?.(message.what);
      case 'settings':
        if (!can('shell')) return fail('settings without the "shell" capability', raw);
        return options.onSettings?.({ muted: message.muted });
      case 'ranked.start': {
        if (!can('ranked')) return reply(message.id, 'capability "ranked" not declared in game.json');
        const start = options.onRankedStart;
        if (!start) return reply(message.id, 'ranked runs are not available here');
        try {
          return reply(message.id, undefined, (await start()) as JsonValue);
        } catch (error) {
          return reply(message.id, error instanceof Error ? error.message : String(error));
        }
      }
      case 'ranked.finish': {
        if (!can('ranked')) return reply(message.id, 'capability "ranked" not declared in game.json');
        const most = manifest.ranked?.maxMoves ?? MAX_RANKED_MOVES;
        if (message.moves.length > most) return reply(message.id, `a ranked run has at most ${most} moves`);
        return settle(message.id, () =>
          options.onRankedFinish?.({
            run: message.run,
            moves: message.moves as JsonValue[],
            score: message.score,
          }),
        );
      }
      case 'entry':
        if (!awaitingEntry) return fail('an entry answered without one, or twice', raw);
        awaitingEntry = false;
        return options.onEntry?.(message.result);
      case 'identity.require': {
        const ask = options.onIdentityRequire;
        if (!answers.require || !ask) return reply(message.id, 'unavailable');
        try {
          return reply(
            message.id,
            undefined,
            (await ask({ level: message.level, reason: message.reason })) as JsonValue,
          );
        } catch (error) {
          return reply(message.id, error instanceof Error ? error.message : String(error));
        }
      }
      case 'share': {
        const share = options.onShare;
        if (!answers.share || !share) return reply(message.id, 'unavailable');
        if (jsonBytes(message.payload) > MAX_ENTRY_PAYLOAD_BYTES) {
          fail(`a share payload over ${MAX_ENTRY_PAYLOAD_BYTES} bytes`, raw);
          return reply(message.id, 'not_allowed');
        }
        return settle(message.id, () =>
          share({
            payload: message.payload as JsonValue,
            ...(message.text === undefined ? {} : { text: message.text }),
            ...(message.level === undefined ? {} : { level: message.level }),
          }),
        );
      }
    }
  };

  /**
   * What `init` may carry (ADR 0045): an entry only to a build that declares its kind, never with a table, a replay or
   * a ranked replay, and within 2 KB; `can` all false where the hub answers neither request.
   */
  const admitted = (init: InitPayload): InitPayload => {
    const elsewhere = Boolean(init.room || init.replay || init.rankedReplay);
    const { entry, ...rest } = init;
    const keep =
      entry !== undefined &&
      !elsewhere &&
      (manifest.entries ?? []).includes(entry.kind) &&
      jsonBytes(entry.payload) <= MAX_ENTRY_PAYLOAD_BYTES;
    return {
      ...rest,
      ...(keep ? { entry } : {}),
      ...(init.can ? { can: elsewhere ? { require: false, share: false } : init.can } : {}),
    };
  };

  const settle = async (id: string, action: () => void | Promise<void>) => {
    try {
      await action();
      reply(id);
    } catch (error) {
      reply(id, error instanceof Error ? error.message : String(error));
    }
  };

  const unsubscribe = transport.subscribe((raw) => void handle(raw));

  return {
    ready,
    pause: () => handshaken && send({ tohe: PROTOCOL_VERSION, type: 'pause' }),
    resume: () => handshaken && send({ tohe: PROTOCOL_VERSION, type: 'resume' }),
    setSettings: (settings) => handshaken && send({ tohe: PROTOCOL_VERSION, type: 'settings', settings }),
    roomView: (update) => handshaken && send({ tohe: PROTOCOL_VERSION, type: 'room.view', ...update }),
    roomSeats: (seats, seat) =>
      handshaken && send({ tohe: PROTOCOL_VERSION, type: 'room.seats', seats, seat }),
    roomReaction: (seat, reaction) =>
      handshaken && send({ tohe: PROTOCOL_VERSION, type: 'room.reaction', seat, reaction }),
    menu: () => handshaken && send({ tohe: PROTOCOL_VERSION, type: 'menu' }),
    dispose: () => {
      clearTimeout(timer);
      unsubscribe();
    },
  };
}
