// Local-first storage. Saves and scores land here first, so games keep working when the API is down;
// the `synced` flags are for the sync step that arrives with accounts (see docs/roadmap/walking-skeleton.md).
import type { JsonValue } from '@tohe/game-sdk';
import Dexie, { type EntityTable } from 'dexie';

export interface LocalProfile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
}

export interface LocalSave {
  profileId: string;
  gameId: string;
  data: JsonValue;
  updatedAt: number;
  synced: 0 | 1;
}

export interface LocalScore {
  id?: number;
  profileId: string;
  gameId: string;
  board: string;
  value: number;
  at: number;
  synced: 0 | 1;
}

export interface CacheEntry {
  key: string;
  value: unknown;
  at: number;
}

export type ToheDb = Dexie & {
  profiles: EntityTable<LocalProfile, 'id'>;
  saves: Dexie.Table<LocalSave, [string, string]>;
  scores: EntityTable<LocalScore, 'id'>;
  cache: EntityTable<CacheEntry, 'key'>;
};

export function openDb(name = 'tohe'): ToheDb {
  const db = new Dexie(name) as ToheDb;
  db.version(1).stores({
    profiles: 'id',
    saves: '[profileId+gameId], synced',
    scores: '++id, [profileId+gameId], synced',
    cache: 'key',
  });
  return db;
}

export const db = openDb();
