// What a profile opened last on this device (ADR 0046, docs/architecture/surfaces.md "Coming back"): Trò chơi's first
// screen starts with "Chơi tiếp" — the game this profile opened last, one big tile — then "Gần đây". The hub keeps it
// itself, per profile, in IndexedDB's `cache` table (`opened:<profileId>`): a game's id and when, nothing a game says,
// so the Game Contract does not change. It never leaves the device.
import { useEffect } from 'react';
import type { GameSummary } from '../api/client.ts';
import { db as deviceDb, type ToheDb } from '../storage/db.ts';

/** A game this profile opened, and when (ms since the epoch). */
export interface Opened {
  gameId: string;
  at: number;
}

/** How many games a profile's list remembers. */
export const OPENED_KEPT = 12;

/** How many games "Gần đây" shows after "Chơi tiếp". */
export const RECENT_SHOWN = 6;

export const openedKey = (profileId: string) => `opened:${profileId}`;

/** The list with `gameId` opened at `at`: first, once, and no longer than OPENED_KEPT. */
export function withOpened(list: readonly Opened[], gameId: string, at: number): Opened[] {
  return [{ gameId, at }, ...list.filter((opened) => opened.gameId !== gameId)].slice(0, OPENED_KEPT);
}

/** A stored list read back: anything that is not a list of games and times is no list. */
export function readOpened(value: unknown): Opened[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Opened =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Opened).gameId === 'string' &&
      typeof (item as Opened).at === 'number',
  );
}

/** Remembers that `profileId` opened `gameId` now. */
export async function recordOpened(db: ToheDb, profileId: string, gameId: string, now = Date.now()) {
  await db.transaction('rw', db.cache, async () => {
    const stored = readOpened((await db.cache.get(openedKey(profileId)))?.value);
    await db.cache.put({ key: openedKey(profileId), value: withOpened(stored, gameId, now), at: now });
  });
}

/** What `profileId` opened on this device, the newest first. */
export async function openedBy(db: ToheDb, profileId: string): Promise<Opened[]> {
  return readOpened((await db.cache.get(openedKey(profileId)))?.value);
}

/**
 * "Chơi tiếp" and "Gần đây" from what the profile opened, among the games its catalog lists now — a game gone from the
 * catalog, or not for a child's age, is not offered. `last` is null when the profile opened nothing yet.
 */
export function comingBack(
  opened: readonly Opened[],
  games: readonly GameSummary[],
): { last: GameSummary | null; recent: GameSummary[] } {
  const listed = opened
    .map((item) => games.find((game) => game.id === item.gameId))
    .filter((game): game is GameSummary => game !== undefined);
  return { last: listed[0] ?? null, recent: listed.slice(1, 1 + RECENT_SHOWN) };
}

/** Notes, once the game is known to this profile's catalog, that the player opened it: its menu or its tables. */
export function useOpened(profileId: string, gameId: string, known: boolean) {
  useEffect(() => {
    if (known) void recordOpened(deviceDb, profileId, gameId).catch(() => {});
  }, [profileId, gameId, known]);
}
