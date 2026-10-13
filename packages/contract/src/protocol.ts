import { z } from 'zod';
import { GameId, PROTOCOL_VERSION, Theme } from './manifest.ts';

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

export const GameMessage = z.discriminatedUnion('type', [
  ReadyMessage,
  SaveMessage,
  ScoreMessage,
  ExitMessage,
  LogMessage,
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

export const HostMessage = z.discriminatedUnion('type', [
  InitMessage,
  PauseMessage,
  ResumeMessage,
  SettingsMessage,
  ResultMessage,
]);
export type HostMessage = z.infer<typeof HostMessage>;
export type InitPayload = Omit<z.infer<typeof InitMessage>, 'tohe' | 'type'>;
