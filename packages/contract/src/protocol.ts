import { z } from 'zod';
import { GameId, PROTOCOL_VERSION, Theme } from './manifest.ts';
import { MAX_TELEMETRY_EVENTS, TelemetryEvent } from './telemetry.ts';

/** Max size of a serialized save, in bytes. Larger saves are rejected by the host. */
export const MAX_SAVE_BYTES = 64 * 1024;

/** Marker that every message carries, so both sides ignore unrelated postMessage traffic. */
const envelope = { tohe: z.literal(PROTOCOL_VERSION) };
const requestId = z.string().min(1).max(64);

export const Profile = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().optional(),
});
export type Profile = z.infer<typeof Profile>;

export const Settings = z.object({
  muted: z.boolean(),
  /** The theme the hub is showing. Games that declare both `themes` follow it; others ignore it (ADR 0013). */
  theme: Theme,
});
export type Settings = z.infer<typeof Settings>;

// ---------------------------------------------------------------- rooms (ADR 0016)

/** Preset reactions a player may send at a table: no typed text (ADR 0016). Games and the hub draw them. */
export const REACTIONS = ['wave', 'laugh', 'wow', 'clap', 'hurry', 'gg', 'sad', 'heart'] as const;
export const Reaction = z.enum(REACTIONS);
export type Reaction = z.infer<typeof Reaction>;

export const RoomSeat = z
  .object({
    /** The player in this seat; null for an empty seat or one a bot holds from the start. */
    profile: Profile.nullable(),
    /** The bot's level while a bot plays this seat (from the start, or for a player who lost the connection). */
    bot: z.string().max(16).nullable(),
    /** The player's phone is connected (always true for bots). */
    connected: z.boolean(),
    /** The seat's points over the room's hands so far (the table's score sheet). */
    score: z.number().int().optional(),
  })
  .strict();
export type RoomSeat = z.infer<typeof RoomSeat>;

export const RoomInfo = z
  .object({
    id: z.string().min(1).max(64),
    /** The seat this phone plays, or -1 for a spectator. */
    seat: z.number().int().min(-1).max(7),
    seats: z.array(RoomSeat).min(2).max(8),
    /** The room's game options (house rules), by id, as declared in game.json's `rooms.options`. */
    options: z.record(z.string(), z.json()),
  })
  .strict();
export type RoomInfo = z.infer<typeof RoomInfo>;

// ---------------------------------------------------------------- game -> host

export const ReadyMessage = z.object({
  ...envelope,
  type: z.literal('ready'),
  gameId: GameId,
  sdkVersion: z.string(),
});

export const SaveMessage = z.object({
  ...envelope,
  type: z.literal('save'),
  id: requestId,
  data: z.json(),
});

export const ScoreMessage = z.object({
  ...envelope,
  type: z.literal('score'),
  id: requestId,
  value: z.number().finite(),
  board: z.string().max(40).default('default'),
  /** A long run reports its score as it grows under one id; the hub keeps one score per run (ADR 0014). */
  run: z.string().min(1).max(64).optional(),
  /** False while the run goes on. A one-shot score, or a run's last report, is final. */
  final: z.boolean().default(true),
});

export const ExitMessage = z.object({
  ...envelope,
  type: z.literal('exit'),
});

export const LogMessage = z.object({
  ...envelope,
  type: z.literal('log'),
  level: z.enum(['info', 'warn', 'error']),
  message: z.string().max(2000),
});

/** Errors, counts, metrics and frame summaries for the hub to send on (ADR 0015); only when `init.telemetry` is true. */
export const TelemetryMessage = z.object({
  ...envelope,
  type: z.literal('telemetry'),
  events: z.array(TelemetryEvent).min(1).max(MAX_TELEMETRY_EVENTS),
});

/** An action at the table, refereed by the server; answered by `result` with the rules' error code if refused. */
export const RoomActMessage = z.object({
  ...envelope,
  type: z.literal('room.act'),
  id: requestId,
  action: z.json(),
});

/** The player is ready for the next hand; answered by `result`. */
export const RoomNextMessage = z.object({ ...envelope, type: z.literal('room.next'), id: requestId });

export const RoomReactMessage = z.object({ ...envelope, type: z.literal('room.react'), reaction: Reaction });

export const GameMessage = z.discriminatedUnion('type', [
  ReadyMessage,
  SaveMessage,
  ScoreMessage,
  ExitMessage,
  LogMessage,
  TelemetryMessage,
  RoomActMessage,
  RoomNextMessage,
  RoomReactMessage,
]);
export type GameMessage = z.infer<typeof GameMessage>;
export type GameMessageInput = z.input<typeof GameMessage>;

// ---------------------------------------------------------------- host -> game

export const InitMessage = z.object({
  ...envelope,
  type: z.literal('init'),
  profile: Profile,
  locale: z.string(),
  settings: Settings,
  /** Last saved state for this profile and game, or null. */
  save: z.json().nullable(),
  /** Seed for deterministic randomness, e.g. a daily challenge. */
  seed: z.number().int(),
  /** The hub collects telemetry for this session (ADR 0015). Absent, as from older hubs, means no. */
  telemetry: z.boolean().optional(),
  /** The table this game was opened at (ADR 0016); absent when it plays on its own. */
  room: RoomInfo.optional(),
});

export const PauseMessage = z.object({ ...envelope, type: z.literal('pause') });
export const ResumeMessage = z.object({ ...envelope, type: z.literal('resume') });

export const SettingsMessage = z.object({
  ...envelope,
  type: z.literal('settings'),
  settings: Settings,
});

export const ResultMessage = z.object({
  ...envelope,
  type: z.literal('result'),
  replyTo: requestId,
  ok: z.boolean(),
  error: z.string().optional(),
});

/** The seat's whole view after a change, and the public events since the last one (ADR 0016). */
export const RoomViewMessage = z.object({
  ...envelope,
  type: z.literal('room.view'),
  /** Opaque to the hub: what the rules module's `view()` returned for this seat. */
  view: z.json(),
  /** What happened since the previous view, to animate; empty after a (re)connection. */
  events: z.array(z.json()).max(200),
  /** Grows with every view of the room, so a game can drop one that arrives late. */
  seq: z.number().int().nonnegative(),
  /** Milliseconds left on the turn timer, or null when there is none. */
  turnMs: z.number().int().nonnegative().nullable(),
});

/** The players at the table changed (someone joined, left, lost the connection, or a bot took a seat). */
export const RoomSeatsMessage = z.object({
  ...envelope,
  type: z.literal('room.seats'),
  seats: z.array(RoomSeat).max(8),
  /** This phone's seat, which can move between hands when the table is rearranged; -1 for a spectator. */
  seat: z.number().int().min(-1).max(7),
});

export const RoomReactionMessage = z.object({
  ...envelope,
  type: z.literal('room.reaction'),
  seat: z.number().int().min(0).max(7),
  reaction: Reaction,
});

export const HostMessage = z.discriminatedUnion('type', [
  InitMessage,
  PauseMessage,
  ResumeMessage,
  SettingsMessage,
  ResultMessage,
  RoomViewMessage,
  RoomSeatsMessage,
  RoomReactionMessage,
]);
export type HostMessage = z.infer<typeof HostMessage>;
export type InitPayload = Omit<z.infer<typeof InitMessage>, 'tohe' | 'type'>;
