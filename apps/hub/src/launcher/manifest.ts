import { type Capability, type GameManifest, PROTOCOL_VERSION } from '@tohe/contract';
import type { GameSummary } from '../api/client.ts';

/** The host bridge enforces capabilities from the manifest; rebuild the parts it needs from the API view. */
export function manifestFrom(game: GameSummary): GameManifest {
  const entryUrl = new URL(game.entryUrl);
  return {
    id: game.id,
    name: game.name,
    version: game.version,
    protocol: PROTOCOL_VERSION,
    description: game.description,
    entry: entryUrl.pathname.split('/').pop() || 'index.html',
    orientation: game.orientation as GameManifest['orientation'],
    capabilities: game.capabilities.filter((c): c is Capability => c === 'save' || c === 'scores'),
    minAge: game.minAge,
    tags: game.tags,
    sizeBudgetKb: Math.max(game.sizeKb, 1),
  };
}

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
