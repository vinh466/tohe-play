import { describe, expect, it } from 'vitest';
import type { RoomView } from './api/client.ts';
import { replayFor } from './pages/ReplayPage.tsx';
import { formatCode, gameSeats, normalizeCode, quickPick, withDefaults } from './rooms/model.ts';
import { isLocalPath } from './session/next.ts';

const room = (over: Partial<RoomView> = {}): RoomView => ({
  id: 'r1',
  code: '482913',
  gameId: 'tien-len',
  gameVersion: '0.2.0',
  status: 'playing',
  hostProfileId: 'p-bo',
  isPublic: true,
  accountOnly: false,
  locked: false,
  seats: 4,
  botsFill: true,
  botLevel: 'normal',
  botsTakeOver: true,
  turnSeconds: 20,
  options: {},
  seatList: [
    { seat: 0, profileId: 'p-bo', name: 'Bố', avatar: '🦊', bot: null, connected: true, ready: false },
    { seat: 1, profileId: null, name: null, avatar: null, bot: null, connected: true, ready: false },
    { seat: 2, profileId: 'p-na', name: 'Na', avatar: '🐼', bot: 'normal', connected: false, ready: false },
    { seat: 3, profileId: null, name: null, avatar: null, bot: 'easy', connected: true, ready: false },
  ],
  scores: [2, 0, -1, -1],
  hand: 1,
  handSeats: [0, 2, 3],
  mySeat: 2,
  spectators: false,
  watchers: [],
  ...over,
});

describe('room codes', () => {
  it('reads codes typed with spaces, pasted with text, or inside a link', () => {
    expect(normalizeCode('482 913')).toBe('482913');
    expect(normalizeCode('mã: 48-29-13!')).toBe('482913');
    expect(normalizeCode('http://10.100.0.2:4820/r/482913')).toBe('482913');
    expect(normalizeCode('1234567')).toBe('123456');
    expect(formatCode('482913')).toBe('482 913');
  });
});

describe('a table as the game sees it', () => {
  it('lists the hand seats in the rules order, with bots and lost connections, and finds this phone', () => {
    const { seats, seat } = gameSeats(room());
    expect(seat).toBe(1);
    expect(seats).toEqual([
      { profile: { id: 'p-bo', name: 'Bố', avatar: '🦊' }, bot: null, connected: true, score: 2 },
      { profile: { id: 'p-na', name: 'Na', avatar: '🐼' }, bot: 'normal', connected: false, score: -1 },
      { profile: null, bot: 'easy', connected: true, score: -1 },
    ]);
  });

  it('gives a phone that is not in the hand the spectator seat', () => {
    expect(gameSeats(room({ mySeat: 1 })).seat).toBe(-1);
    expect(gameSeats(room({ mySeat: null })).seat).toBe(-1);
  });
});

describe('the lobby', () => {
  it('quick play joins the fullest waiting room that has a seat, never a locked or own one', () => {
    const rooms = [
      { id: 'a', status: 'waiting', taken: 1, seats: 4, locked: false, mine: false },
      { id: 'b', status: 'waiting', taken: 3, seats: 4, locked: false, mine: false },
      { id: 'c', status: 'waiting', taken: 3, seats: 4, locked: true, mine: false },
      { id: 'd', status: 'playing', taken: 3, seats: 4, locked: false, mine: false },
      { id: 'e', status: 'waiting', taken: 4, seats: 4, locked: false, mine: false },
      { id: 'f', status: 'waiting', taken: 3, seats: 4, locked: false, mine: true },
    ];
    expect(quickPick(rooms)?.id).toBe('b');
    expect(quickPick([])).toBeUndefined();
  });

  it("fills a room's options from the game's defaults", () => {
    const label = { vi: 'x', en: 'x' };
    expect(
      withDefaults(
        [
          { id: 'chopChain', type: 'boolean', label, default: true },
          { id: 'points', type: 'choice', label, choices: [], default: 'full' },
        ],
        { chopChain: false },
      ),
    ).toEqual({ chopChain: false, points: 'full' });
  });
});

describe('the way back after signing in', () => {
  it('only ever goes to a page of this hub', () => {
    expect(isLocalPath('/r/482913')).toBe(true);
    expect(isLocalPath('/play/tien-len/rooms/0198-abc')).toBe(true);
    expect(isLocalPath('//evil.example/r/1')).toBe(false);
    expect(isLocalPath('https://evil.example')).toBe(false);
    expect(isLocalPath('javascript:alert(1)')).toBe(false);
  });
});

describe('a replay', () => {
  it('hands the game the seats, its own seat, the seed and the actions', () => {
    const replay = replayFor(
      {
        roomId: 'r1',
        hand: 2,
        gameId: 'tien-len',
        gameVersion: '0.3.0',
        seed: 42,
        options: { chopChain: true },
        carry: { leader: 1 },
        seats: [
          { profileId: 'p-bo', name: 'Bố', avatar: '🦊', bot: null, deleted: false },
          { profileId: null, name: null, avatar: null, bot: 'easy', deleted: false },
          // A player whose profile was deleted since (ADR 0034): a person still, with nothing of them.
          { profileId: 'p-random', name: null, avatar: null, bot: null, deleted: true },
        ],
        actions: [{ seat: 1, action: { type: 'pass' } }],
        result: { points: [2, -2] },
        mySeat: 0,
        finishedAt: '2026-10-16T10:00:00Z',
      },
      'Người chơi đã xoá',
    );
    expect(replay).toEqual({
      seats: [
        { profile: { id: 'p-bo', name: 'Bố', avatar: '🦊' }, bot: null, connected: true },
        { profile: null, bot: 'easy', connected: true },
        {
          profile: { id: 'p-random', name: 'Người chơi đã xoá', avatar: undefined },
          bot: null,
          connected: true,
        },
      ],
      seat: 0,
      seed: 42,
      options: { chopChain: true },
      carry: { leader: 1 },
      actions: [{ seat: 1, action: { type: 'pass' } }],
    });
  });
});
