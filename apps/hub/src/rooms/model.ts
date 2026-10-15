// Online rooms (ADR 0016) as the hub sees them: pure helpers, tested in rooms.test.ts.
import type { LocalizedText, RoomOption, RoomSeat } from '@tohe/contract';
import type { RoomView } from '../api/client.ts';

/** "482913" → "482 913": easier to read across a table. */
export const formatCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** Digits only: pasted codes may carry spaces or a whole link. */
export function normalizeCode(input: string): string {
  const fromLink = /\/r\/(\d{6})/.exec(input)?.[1];
  return (fromLink ?? input.replace(/\D/g, '')).slice(0, 6);
}

/** The link that joins a room: `/r/<code>` on this hub. */
export const joinLink = (code: string, origin = window.location.origin) => `${origin}/r/${code}`;

/** Text of a game's option in the hub's language. */
export const localized = (text: LocalizedText, language: string) =>
  language.startsWith('vi') ? text.vi : text.en;

/** A room's game options with every declared option set: the given value, else the game's default. */
export function withDefaults(
  options: RoomOption[],
  given: Record<string, unknown> = {},
): Record<string, unknown> {
  return Object.fromEntries(options.map((option) => [option.id, given[option.id] ?? option.default]));
}

/** The seats of the current hand as the game sees them, in the rules module's order, and this phone's seat in it. */
export function gameSeats(room: RoomView): { seats: RoomSeat[]; seat: number } {
  const seats = room.handSeats.map((roomSeat) => {
    const seat = room.seatList[roomSeat];
    return {
      profile: seat?.profileId
        ? { id: seat.profileId, name: seat.name ?? '', avatar: seat.avatar ?? undefined }
        : null,
      bot: seat?.bot ?? null,
      connected: seat?.connected ?? true,
    };
  });
  const seat = room.mySeat === null ? -1 : room.handSeats.indexOf(room.mySeat);
  return { seats, seat };
}

/** The room the quick-play button joins: a waiting public room with a free seat, the fullest first. */
export function quickPick<
  T extends { status: string; taken: number; seats: number; locked: boolean; mine: boolean },
>(rooms: T[]): T | undefined {
  return rooms
    .filter((room) => !room.mine && !room.locked && room.status === 'waiting' && room.taken < room.seats)
    .sort((a, b) => b.taken - a.taken)[0];
}

export const TURN_CHOICES = [0, 15, 20, 30, 60] as const;
