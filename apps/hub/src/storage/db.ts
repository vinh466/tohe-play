// Local-first storage. Saves and scores land here first, so games keep working when the API is down; sync.ts pushes
// what is not `synced` yet and pulls what other devices wrote (M2, ADR 0005).
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
  /** Server time of the version this device last exchanged with the API (sync compares it). */
  serverUpdatedAt?: number;
}

export interface LocalScore {
  id?: number;
  profileId: string;
  gameId: string;
  board: string;
  value: number;
  at: number;
  synced: 0 | 1;
  /** Lets the API store a score sent twice (a retry after a lost answer) only once. */
  clientId: string;
  /** A long run's id: its reports update this one row (ADR 0014). */
  run?: string;
  /** False while the run goes on; absent (rows before ADR 0014) means final. */
  final?: boolean;
}

/** A ranked run handed in (ADR 0030), kept until the API took it for its replay. */
export interface LocalRanked {
  id?: number;
  profileId: string;
  gameId: string;
  /** The run the API opened. */
  run: string;
  moves: JsonValue[];
  score: number;
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
  ranked: EntityTable<LocalRanked, 'id'>;
  cache: EntityTable<CacheEntry, 'key'>;
};

/** crypto.randomUUID only exists in secure contexts; a phone on plain http over the LAN (UAT) is not one. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function openDb(name = 'tohe'): ToheDb {
  const db = new Dexie(name) as ToheDb;
  db.version(1).stores({
    profiles: 'id',
    saves: '[profileId+gameId], synced',
    scores: '++id, [profileId+gameId], synced',
    cache: 'key',
  });
  // v2 (M2): scores carry a clientId so pushing them is idempotent.
  db.version(2)
    .stores({ scores: '++id, [profileId+gameId], synced, clientId' })
    .upgrade((tx) =>
      tx
        .table('scores')
        .toCollection()
        .modify((score: LocalScore) => {
          score.clientId ??= newId();
        }),
    );
  // v3 (ADR 0030): ranked runs handed in, waiting to reach the API.
  db.version(3).stores({ ranked: '++id, synced' });
  return db;
}

export const db = openDb();
