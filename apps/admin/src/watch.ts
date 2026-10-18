// Watching a ranked run in the game itself (ADR 0032): what the console needs as the game's host — the manifest the
// host checks the game's messages against, and the init that opens the build with the run to play back. Loaded with
// the viewer only, so the console's pages do without the contract's schemas.
import { Capability, type GameManifest, type InitPayload, PROTOCOL_VERSION } from '@tohe/contract';
import type { JsonValue } from '@tohe/game-sdk';
import type { ProfileCard, RunReplay } from './api/client.ts';

export type RunBuild = NonNullable<RunReplay['build']>;

/** The host reads a game's id and capabilities; the rest is filled so the manifest's type holds. */
export function manifestOf(run: RunReplay, build: RunBuild): GameManifest {
  return {
    id: run.gameId,
    name: build.name,
    version: build.version,
    protocol: PROTOCOL_VERSION,
    description: '',
    entry: new URL(build.entryUrl).pathname.split('/').pop() || 'index.html',
    orientation: build.orientation as GameManifest['orientation'],
    capabilities: build.capabilities.filter((c): c is Capability => Capability.safeParse(c).success),
    themes: ['light'],
    minAge: 0,
    tags: [],
    sizeBudgetKb: 1,
  };
}

/** The build opens with the run instead of a game: it plays the moves back, muted, and records nothing. */
export function replayInit(run: RunReplay, player: ProfileCard | null, theme: 'light' | 'dark'): InitPayload {
  return {
    profile: player
      ? { id: player.id, name: player.name, avatar: player.avatar }
      : { id: 'player', name: 'Người chơi' },
    locale: 'vi',
    settings: { muted: true, theme },
    save: null,
    seed: run.seed,
    rankedReplay: { seed: run.seed, moves: Array.isArray(run.moves) ? (run.moves as JsonValue[]) : [] },
  };
}
