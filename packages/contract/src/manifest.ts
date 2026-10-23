import { z } from 'zod';
import { GameAssets } from './assets.ts';
import { GameId, SemVer } from './ids.ts';

/** Current Game Contract protocol version. See docs/contracts/game-contract-v1.md. */
export const PROTOCOL_VERSION = 1;

export { GameId, SemVer } from './ids.ts';

/**
 * What a game uses: `save`, `scores`, `rooms` (online tables, ADR 0016), `shell` (it draws its own main menu and
 * in-game menu with the way back to Tò He, ADR 0018), `ranked` (runs the server replays, ADR 0030).
 */
export const Capability = z.enum(['save', 'scores', 'rooms', 'shell', 'ranked']);
export type Capability = z.infer<typeof Capability>;

/**
 * The identity levels of ADR 0043: `any` — any profile, a device's made silently; `named` — others see the name;
 * `account` — an account's profile (sync, an ID, public boards).
 */
export const IDENTITY_LEVELS = ['any', 'named', 'account'] as const;
export const IdentityLevel = z.enum(IDENTITY_LEVELS);
export type IdentityLevel = z.infer<typeof IdentityLevel>;

/** The least a table asks for (ADR 0043): a name others see, or an account. */
export const RoomsLevel = z.enum(['named', 'account']);
export type RoomsLevel = z.infer<typeof RoomsLevel>;

/**
 * What a game asks of its player (ADR 0045): `play` — what opening it asks for, at a table too; `rooms` — the least a
 * table of it asks for, only with the `rooms` capability. A table asks for the highest of `play`, `rooms` and its
 * creator's door.
 */
export const GameIdentity = z
  .object({
    play: IdentityLevel.default('any').describe(
      'What opening the game asks for (ADR 0043): any, named or account',
    ),
    rooms: RoomsLevel.optional().describe(
      'The least a table of this game asks for; only with the "rooms" capability (default named)',
    ),
  })
  .strict();
export type GameIdentity = z.infer<typeof GameIdentity>;

/**
 * The kinds of entry a game opens itself (ADR 0044, 0045): `share` — a share link's payload. "Entry" is ADR 0044's way
 * in, not the manifest's `entry` (the game's HTML file).
 */
export const ENTRY_KINDS = ['share'] as const;
export const EntryKind = z.enum(ENTRY_KINDS);
export type EntryKind = z.infer<typeof EntryKind>;

/** Most bytes of an entry's payload, as UTF-8 JSON (ADR 0045). */
export const MAX_ENTRY_PAYLOAD_BYTES = 2048;

/** How many payloads `entries/share.json` holds for conformance (ADR 0045). */
export const ENTRY_SAMPLES = { min: 1, max: 5 } as const;

/** Where a build ships the payloads its share makes, for conformance: `entries/share.json`. */
export const entrySamplesPath = (kind: EntryKind) => `entries/${kind}.json`;

/**
 * A language tag as `init.locale` carries it (ADR 0048): BCP 47 limited to a language, an optional script and an
 * optional region, in canonical case — `vi`, `en`, `en-GB`, `zh-Hant`, `es-419`.
 */
export const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|[0-9]{3}))?$/;
export const LanguageTag = z
  .string()
  .regex(LANGUAGE_TAG, 'a language tag such as vi, en, en-GB or zh-Hant, in canonical case');
export type LanguageTag = z.infer<typeof LanguageTag>;

/** Most languages a manifest's `names` or `descriptions` holds (ADR 0048). */
export const MAX_LANGUAGES = 10;

/** Most characters of a game's name, standard or per language. */
export const MAX_NAME_LENGTH = 40;
/** Most characters of a game's description, standard or per language. */
export const MAX_DESCRIPTION_LENGTH = 200;

/** Words per language (ADR 0048): a language tag → non-empty text of at most `max` characters. */
const perLanguage = (max: number) =>
  z
    .record(LanguageTag, z.string().min(1).max(max))
    .refine((byTag) => Object.keys(byTag).length <= MAX_LANGUAGES, `at most ${MAX_LANGUAGES} languages`);

/** Words per language, as a game's manifest or the API's game summary carry them. */
export type PerLanguage = Partial<Record<string, string>>;

/**
 * The words of `byTag` for a reader's `language` (ADR 0048): the exact tag, then its primary subtag (`en-GB` → `en`),
 * then `fallback`. Tags compare without regard to case and `_` reads as `-`.
 */
export function inLanguage(
  byTag: PerLanguage | null | undefined,
  language: string,
  fallback: string,
): string {
  if (!byTag) return fallback;
  const wanted = language.trim().replaceAll('_', '-').toLowerCase();
  const primary = wanted.split('-')[0] ?? '';
  const keys = Object.keys(byTag);
  for (const tag of [wanted, primary]) {
    const key = tag ? keys.find((candidate) => candidate.toLowerCase() === tag) : undefined;
    const words = key === undefined ? undefined : byTag[key];
    if (words) return words;
  }
  return fallback;
}

/** A game's name for a reader's language: its name in that language, else its standard `name` (ADR 0048). */
export const gameName = (game: { name: string; names?: PerLanguage | null }, language: string) =>
  inLanguage(game.names, language, game.name);

/** A game's description for a reader's language, else its standard `description` (ADR 0048). */
export const gameDescription = (
  game: { description: string; descriptions?: PerLanguage | null },
  language: string,
) => inLanguage(game.descriptions, language, game.description);

/** Light or dark (ADR 0013). */
export const Theme = z.enum(['light', 'dark']);
export type Theme = z.infer<typeof Theme>;

/** Text the hub shows for a game in its own screens (room options), in each language of the hub. */
export const LocalizedText = z
  .object({ vi: z.string().min(1).max(60), en: z.string().min(1).max(60) })
  .strict();
export type LocalizedText = z.infer<typeof LocalizedText>;

const OptionId = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9]{0,31}$/, 'letters and digits, starting with a letter');
const ChoiceId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,31}$/, 'letters, digits and dashes');
const RoomChoice = z.object({ id: ChoiceId, label: LocalizedText }).strict();

/** One game option of a room (house rules), drawn by the hub when a room is created (ADR 0016). */
export const RoomOption = z.discriminatedUnion('type', [
  z.object({ id: OptionId, type: z.literal('boolean'), label: LocalizedText, default: z.boolean() }).strict(),
  z
    .object({
      id: OptionId,
      type: z.literal('choice'),
      label: LocalizedText,
      choices: z.array(RoomChoice).min(2).max(12),
      default: ChoiceId,
    })
    .strict(),
  z
    .object({
      id: OptionId,
      type: z.literal('multi'),
      label: LocalizedText,
      choices: z.array(RoomChoice).min(1).max(12),
      default: z.array(ChoiceId).max(12),
    })
    .strict(),
]);
export type RoomOption = z.infer<typeof RoomOption>;

/** A game played at a table of several phones (ADR 0016): its rules module, seats, bots and options. */
export const RoomsManifest = z
  .object({
    rules: z
      .string()
      .regex(/^[\w-]+(?:\/[\w-]+)*\.m?js$/, 'a relative path to an ES module in the build')
      .default('rules.js')
      .describe('ES module in the build that exports `rules`; the API referees with it'),
    seats: z.object({ min: z.number().int().min(2).max(8), max: z.number().int().min(2).max(8) }).strict(),
    bots: z
      .array(z.string().regex(/^[a-z]{2,16}$/))
      .max(5)
      .default([])
      .describe('Bot levels the rules module plays, easiest first; empty if it has no bots'),
    options: z.array(RoomOption).max(24).default([]),
  })
  .strict();
export type RoomsManifest = z.infer<typeof RoomsManifest>;

/**
 * A one-player game whose runs the server replays (ADR 0030): its verify module, the board ranked runs count on, and
 * how fast a person can play.
 */
export const RankedManifest = z
  .object({
    verify: z
      .string()
      .regex(/^[\w-]+(?:\/[\w-]+)*\.m?js$/, 'a relative path to an ES module in the build')
      .default('verify.js')
      .describe('ES module in the build that exports `verify`; the API replays ranked runs with it'),
    board: z.string().min(1).max(40).default('default').describe('The board ranked runs count on'),
    minMsPerMove: z
      .number()
      .int()
      .min(0)
      .max(60_000)
      .default(100)
      .describe('A person needs at least this long per move; a faster run is held for a person to look at'),
    maxMoves: z
      .number()
      .int()
      .min(1)
      .max(100_000)
      .default(20_000)
      .describe('Most moves a ranked run can have'),
  })
  .strict();
export type RankedManifest = z.infer<typeof RankedManifest>;

/** `game.json` — shipped next to every game build. */
export const GameManifest = z
  .object({
    /** Optional, lets editors validate game.json against schema/game-manifest.schema.json. */
    $schema: z.string().optional(),
    id: GameId,
    name: z
      .string()
      .min(1)
      .max(MAX_NAME_LENGTH)
      .describe('The standard name: English, or a proper name such as Tiến Lên (ADR 0048)'),
    names: perLanguage(MAX_NAME_LENGTH)
      .optional()
      .describe('The name per language tag, when it differs from the standard one (ADR 0048)'),
    version: SemVer,
    protocol: z.literal(PROTOCOL_VERSION),
    description: z
      .string()
      .max(MAX_DESCRIPTION_LENGTH)
      .default('')
      .describe('The standard description, in the language of the standard name (ADR 0048)'),
    descriptions: perLanguage(MAX_DESCRIPTION_LENGTH)
      .optional()
      .describe('The description per language tag (ADR 0048)'),
    entry: z.string().default('index.html'),
    icon: z.string().optional().describe('Path relative to the game root, e.g. icon.svg'),
    orientation: z.enum(['portrait', 'landscape', 'any']).default('portrait'),
    capabilities: z.array(Capability).default([]),
    themes: z
      .array(Theme)
      .min(1)
      .max(2)
      .default(['light'])
      .describe('Looks the game has. With both, it follows the hub through settings.theme (ADR 0013).'),
    minAge: z.number().int().min(0).max(18).default(0),
    tags: z.array(z.string().max(20)).max(8).default([]),
    sizeBudgetKb: z.number().int().positive().max(50_000).default(3000),
    rooms: RoomsManifest.optional().describe('Online rooms (ADR 0016); required with the "rooms" capability'),
    ranked: RankedManifest.optional().describe(
      'Ranked runs (ADR 0030); required with the "ranked" capability',
    ),
    identity: GameIdentity.optional().describe(
      'What the game asks of its player (ADR 0045); without it, any profile opens it and a table asks for a name',
    ),
    entries: z
      .array(EntryKind)
      .max(ENTRY_KINDS.length)
      .optional()
      .describe(
        'Kinds of entry the game opens itself (ADR 0045); with "share", the build ships entries/share.json',
      ),
    assets: GameAssets.optional().describe(
      'Asset packs the game pins (ADR 0053): pack id → exact version and delivery; the build ships them in studio/',
    ),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (manifest.identity?.rooms !== undefined && !manifest.capabilities.includes('rooms')) {
      context.addIssue({
        code: 'custom',
        path: ['identity', 'rooms'],
        message: 'identity.rooms goes with the "rooms" capability',
      });
    }
    if (manifest.entries && new Set(manifest.entries).size !== manifest.entries.length) {
      context.addIssue({ code: 'custom', path: ['entries'], message: 'repeated entry kind' });
    }
    if (manifest.capabilities.includes('ranked') !== (manifest.ranked !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['ranked'],
        message: 'the "ranked" capability and block go together',
      });
    }
    if (manifest.ranked && !manifest.capabilities.includes('scores')) {
      context.addIssue({
        code: 'custom',
        path: ['capabilities'],
        message: 'a ranked game keeps scores: declare "scores" too',
      });
    }
    const rooms = manifest.rooms;
    if (manifest.capabilities.includes('rooms') !== (rooms !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['rooms'],
        message: 'the "rooms" capability and block go together',
      });
    }
    if (!rooms) return;
    if (rooms.seats.min > rooms.seats.max) {
      context.addIssue({ code: 'custom', path: ['rooms', 'seats'], message: 'min is more than max' });
    }
    const ids = new Set<string>();
    rooms.options.forEach((option, index) => {
      if (ids.has(option.id)) {
        context.addIssue({ code: 'custom', path: ['rooms', 'options', index], message: 'repeated id' });
      }
      ids.add(option.id);
      if (option.type === 'boolean') return;
      const known = new Set(option.choices.map((choice) => choice.id));
      const defaults = option.type === 'choice' ? [option.default] : option.default;
      if (!defaults.every((id) => known.has(id))) {
        context.addIssue({
          code: 'custom',
          path: ['rooms', 'options', index],
          message: 'default is not a choice',
        });
      }
    });
  });
export type GameManifest = z.infer<typeof GameManifest>;
export type GameManifestInput = z.input<typeof GameManifest>;

const LEVEL_ORDER: readonly IdentityLevel[] = IDENTITY_LEVELS;

/** The highest of identity levels (ADR 0043): what the hub asks for. */
export function highestIdentityLevel(...levels: (IdentityLevel | null | undefined)[]): IdentityLevel {
  return levels.reduce<IdentityLevel>(
    (high, level) => (level && LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(high) ? level : high),
    'any',
  );
}

/**
 * A game's levels with their defaults (ADR 0045): `play` (`any`), and for a game with rooms what a table of it asks
 * for at least — the highest of `play` and `rooms` (`named`); null without rooms.
 */
export function gameLevels(manifest: Pick<GameManifest, 'identity' | 'capabilities'>): {
  play: IdentityLevel;
  table: IdentityLevel | null;
} {
  const play = manifest.identity?.play ?? 'any';
  return {
    play,
    table: manifest.capabilities.includes('rooms')
      ? highestIdentityLevel(play, manifest.identity?.rooms ?? 'named')
      : null,
  };
}

/** The bytes of a JSON value as the hub sends it: UTF-8 of `JSON.stringify`. */
export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value) ?? '').byteLength;
}

/** `catalog.json` — produced by the games assembler at the root of the games origin. */
export const CatalogEntry = z
  .object({
    manifest: GameManifest,
    /** Path of the immutable build on the games origin, e.g. `hello/1.0.0/`. */
    path: z.string().regex(/^[a-z0-9-]+\/[^/]+\/$/),
    sizeKb: z.number().int().nonnegative(),
  })
  .strict();
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const Catalog = z
  .object({
    generatedAt: z.iso.datetime(),
    games: z.array(CatalogEntry),
  })
  .strict();
export type Catalog = z.infer<typeof Catalog>;
