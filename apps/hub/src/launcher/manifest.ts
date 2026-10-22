import {
  Capability,
  EntryKind,
  type GameManifest,
  IdentityLevel,
  PROTOCOL_VERSION,
  type RoomOption,
  RoomsLevel,
} from '@tohe/contract';
import type { GameSummary } from '../api/client.ts';

/** The host bridge enforces capabilities from the manifest; rebuild the parts it needs from the API view. */
export function manifestFrom(game: GameSummary): GameManifest {
  const entryUrl = new URL(game.entryUrl);
  return {
    id: game.id,
    name: game.name,
    // A catalog cached before the API returned the words per language has none (ADR 0048).
    ...(game.names ? { names: game.names } : {}),
    version: game.version,
    protocol: PROTOCOL_VERSION,
    description: game.description,
    ...(game.descriptions ? { descriptions: game.descriptions } : {}),
    entry: entryUrl.pathname.split('/').pop() || 'index.html',
    orientation: game.orientation as GameManifest['orientation'],
    capabilities: game.capabilities.filter((c): c is Capability => Capability.safeParse(c).success),
    // Online rooms (ADR 0016): the host bridge only checks the capability; the API referees with the rules module.
    rooms: game.rooms
      ? {
          rules: 'rules.js',
          seats: { min: game.rooms.minSeats, max: game.rooms.maxSeats },
          bots: game.rooms.bots,
          options: game.rooms.options as unknown as RoomOption[],
        }
      : undefined,
    // What the game asks of its player and the entries it opens itself (ADR 0045): the host sends an entry only to a
    // build that declares its kind.
    identity: {
      play: IdentityLevel.safeParse(game.identity?.play).data ?? 'any',
      ...(game.rooms && RoomsLevel.safeParse(game.identity?.rooms).success
        ? { rooms: game.identity?.rooms as RoomsLevel }
        : {}),
    },
    entries: (game.entries ?? []).filter((kind): kind is EntryKind => EntryKind.safeParse(kind).success),
    // Not read by the host: the hub always sends the theme it shows, and the API does not list `themes`.
    themes: ['light'],
    minAge: game.minAge,
    tags: game.tags,
    sizeBudgetKb: Math.max(game.sizeKb, 1),
  };
}

/** The game draws its own main menu and menu with the way back to Tò He (ADR 0018): the hub draws no bar over it. */
export const hasShell = (game: GameSummary) => game.capabilities.includes('shell');

/** Same seed for everyone on the same local day: the basis for daily challenges. */
export function dailySeed(date = new Date()): number {
  return date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** Refuse to embed anything that is not on the configured games origin. */
export function isTrustedEntry(entryUrl: string, gamesOrigin: string): boolean {
  try {
    return new URL(entryUrl).origin === new URL(gamesOrigin).origin;
  } catch {
    return false;
  }
}
