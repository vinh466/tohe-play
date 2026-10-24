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

/**
 * The key the public pages read to show a device "Chơi tiếp" in place of "Chơi ngay" (apps/web returning.js, ADR 0046):
 * set once this device has opened a game, never on a plain start of the app.
 */
export const RETURNING_KEY = 'tohe:returning';

/** Notes in `storage` that this device has opened a game; with storage blocked there is nothing to note. */
export function markReturning(storage: Pick<Storage, 'setItem'> | undefined) {
  try {
    storage?.setItem(RETURNING_KEY, '1');
  } catch {
    // The public pages show "Chơi ngay", which leads here too.
  }
}

/**
 * The key the public pages read to greet a device that has played (apps/web greeting.js, ADR 0055): who played last and
 * the game they opened, so `/` says "Chào lại, An" with *Chơi tiếp Ghép Khối*. Written with `tohe:returning`; removed
 * when that profile is deleted or its account signs out. Nothing else is in it, and it never leaves the device.
 */
export const GREETING_KEY = 'tohe:greeting';

/** What the greeting holds: the profile (its id, to forget it with the profile), its name and avatar, the game's id. */
export interface Greeting {
  id: string;
  name: string;
  avatar: string;
  game: string;
}

/** Notes in `storage` who opened `gameId` here, for the public pages' greeting. */
export function markGreeting(
  storage: Pick<Storage, 'setItem'> | undefined,
  player: { id: string; name: string; avatar: string },
  gameId: string,
) {
  const greeting: Greeting = { id: player.id, name: player.name, avatar: player.avatar, game: gameId };
  try {
    storage?.setItem(GREETING_KEY, JSON.stringify(greeting));
  } catch {
    // The public pages greet without a name: "Chơi tiếp".
  }
}

/** The greeting kept in `storage`, or null when there is none or it is not one. */
export function readGreeting(storage: Pick<Storage, 'getItem'> | undefined): Greeting | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(GREETING_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const { id, name, avatar, game } = value as Record<string, unknown>;
    return typeof id === 'string' &&
      typeof name === 'string' &&
      typeof avatar === 'string' &&
      typeof game === 'string'
      ? { id, name, avatar, game }
      : null;
  } catch {
    return null;
  }
}

/**
 * Forgets the greeting: of `profileId` only (that profile was deleted), or whoever it greets (an account signed out —
 * the next person on this device is not greeted by its name).
 */
export function forgetGreeting(
  storage: Pick<Storage, 'getItem' | 'removeItem'> | undefined,
  profileId?: string,
) {
  try {
    if (profileId === undefined || readGreeting(storage)?.id === profileId) storage?.removeItem(GREETING_KEY);
  } catch {
    // Nothing kept, nothing to forget.
  }
}

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

/**
 * Notes, once the game is known to this profile's catalog, that the player opened it: its menu or its tables. The
 * device is then a returning one for the public pages (`tohe:returning`), which greet this player by name
 * (`tohe:greeting`, ADR 0055).
 */
export function useOpened(
  player: { id: string; name: string; avatar: string },
  gameId: string,
  known: boolean,
) {
  const { id, name, avatar } = player;
  useEffect(() => {
    if (!known) return;
    markReturning(globalThis.localStorage);
    markGreeting(globalThis.localStorage, { id, name, avatar }, gameId);
    void recordOpened(deviceDb, id, gameId).catch(() => {});
  }, [id, name, avatar, gameId, known]);
}
