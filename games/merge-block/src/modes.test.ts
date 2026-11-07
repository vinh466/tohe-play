import { describe, expect, it } from 'vitest';
import {
  blockValue,
  COLS,
  choosePart,
  clockOut,
  currentOrder,
  fire,
  indexOf,
  newGame,
  ORDERS,
  offerParts,
  PART_IDS,
  type PartId,
  pressureGain,
  pressureMax,
  pulseMultiplier,
  ROWS,
  restore,
  type State,
  shipExp,
} from './logic.ts';

/** A Ca làm state with a board written top-down; the base run has all four blueprints unlocked. */
function orders(rows: string[], current: number, extra: Partial<State> = {}): State {
  const state = newGame(1, 0, 'orders', { unlocked: [...PART_IDS] });
  const grid = new Array<number>(COLS * ROWS).fill(0);
  rows.forEach((line, i) => {
    const row = ROWS - 1 - i;
    line
      .trim()
      .split(/\s+/)
      .forEach((token, col) => {
        grid[indexOf({ col, row })] = token === '.' ? 0 : Number(token);
      });
  });
  return { ...state, grid, current, next: 1, ...extra };
}

const play = (state: State, col: number) => {
  const result = fire(state, col);
  if (!result.ok) throw new Error(result.reason);
  return result;
};

describe('the modes', () => {
  it('sets the three orders as a 16, two 32s and a 64', () => {
    expect(ORDERS.map((order) => blockValue(order.exp))).toEqual([16, 32, 64]);
    expect(ORDERS.map((order) => order.count)).toEqual([1, 2, 1]);
  });

  it('creates a classic state with no mode fields, an orders state with three, a daily with its date', () => {
    const classic = newGame(1);
    expect(classic.mode).toBe('classic');
    expect(classic.orders).toBeUndefined();
    expect(classic.daily).toBeUndefined();

    const run = newGame(1, 0, 'orders');
    expect(run.orders).toHaveLength(3);
    expect(run.orderIndex).toBe(0);
    expect(run.parts).toEqual([]);
    expect(run.unlocked).toEqual(['tank', 'chute']);
    expect(run.scrap).toBe(0);

    const daily = newGame(1, 0, 'daily', { dailyDate: '2026-11-08' });
    expect(daily.mode).toBe('daily');
    expect(daily.daily).toEqual({ date: '2026-11-08' });
  });

  it('ships the 16, completes the first order and offers 1 of 3 parts', () => {
    const start = orders(['4 . . . .'], 4);
    const result = play(start, 1);
    expect(result.state.mode).toBe('orders');
    expect(result.state.orders?.[0]?.done).toBe(1);
    expect(result.state.choice).toBe(true);
    expect(result.state.offer).toHaveLength(3);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'order', index: 0, complete: true, scrap: 4 }),
    );
    // The 16 merged into a 32 and shipped: 32/16 = 2 scrap, plus the order's 4.
    expect(result.state.scrap).toBe(6);
    expect(result.state.orders?.[1]?.done).toBe(0);

    const part = result.state.offer?.[0];
    if (!part) throw new Error('no offer');
    const chosen = choosePart(result.state, part);
    expect(chosen?.parts).toEqual([part]);
    expect(chosen?.choice).toBe(false);
    expect(chosen?.orderIndex).toBe(1);
    expect(chosen?.offer).toEqual([]);
    expect(choosePart(chosen as State, 'tank')).toBeNull();
  });

  it('completes the three orders and clocks out with the run banked', () => {
    let state = orders(['4 . . . .'], 4);
    let result = play(state, 1);
    let part = result.state.offer?.[0];
    state = choosePart(result.state, part as never) as State;

    state = { ...state, current: 5, grid: new Array<number>(COLS * ROWS).fill(0) };
    state.grid[indexOf({ col: 0, row: ROWS - 1 })] = 5;
    result = play(state, 1);
    expect(result.state.orders?.[1]?.done).toBe(1);
    expect(result.state.choice).toBe(false);
    state = result.state;

    state = { ...state, current: 5, grid: new Array<number>(COLS * ROWS).fill(0) };
    state.grid[indexOf({ col: 0, row: ROWS - 1 })] = 5;
    result = play(state, 1);
    expect(result.state.orders?.[1]?.done).toBe(2);
    expect(result.state.choice).toBe(true);
    part = result.state.offer?.[0];
    state = choosePart(result.state, part as never) as State;
    expect(state.orderIndex).toBe(2);

    state = { ...state, current: 6, grid: new Array<number>(COLS * ROWS).fill(0) };
    state.grid[indexOf({ col: 0, row: ROWS - 1 })] = 6;
    result = play(state, 1);
    expect(result.state.orders?.[2]?.done).toBe(1);
    part = result.state.offer?.[0];
    state = choosePart(result.state, part as never) as State;
    expect(state.orderIndex).toBe(3);

    const clocked = clockOut(state);
    expect(clocked?.state.over).toBe(true);
    expect(clocked?.state.ended).toBe('clock_out');
    expect(clocked?.events[0]?.type).toBe('over');
    expect(clockOut(clocked?.state as State)).toBeNull();
  });

  it('computes the parts: tank, chute, lube, gear', () => {
    const base = newGame(1, 0, 'orders');
    expect(pressureMax(base)).toBe(8);
    expect(pressureGain(base)).toBe(1);
    expect(pulseMultiplier(base)).toBe(2);
    expect(shipExp(base)).toBe(4); // the first order, a 16
    expect(currentOrder(base)?.exp).toBe(4);

    const tank = { ...base, parts: ['tank', 'tank'] as PartId[] };
    expect(pressureMax(tank)).toBe(12);
    const lube = { ...base, parts: ['lube'] as PartId[] };
    expect(pressureGain(lube)).toBe(2);
    const gear = { ...base, parts: ['gear', 'gear'] as PartId[] };
    expect(pulseMultiplier(gear)).toBe(4);
    const chute = { ...base, parts: ['chute'] as PartId[], orderIndex: 1 };
    expect(shipExp(chute)).toBe(4); // the 32 order - 1
    const chute2 = { ...base, parts: ['chute'] as PartId[], orderIndex: 2 };
    expect(shipExp(chute2)).toBe(5); // the 64 order - 1
  });

  it('offers three parts from the unlocked pool, deterministically', () => {
    const [first, rng] = offerParts(['tank', 'chute'], 42);
    const [again, againRng] = offerParts(['tank', 'chute'], 42);
    expect(first).toHaveLength(3);
    expect(first).toEqual(again);
    expect(rng).toBe(againRng);
    expect(first.every((part) => part === 'tank' || part === 'chute')).toBe(true);
  });

  it('keeps the zen mode free of pressure and the jam', () => {
    const start = newGame(1, 0, 'zen');
    const { state } = play(start, 2);
    expect(state.mode).toBe('zen');
    expect(state.pressure).toBe(0);
    expect(state.over).toBe(false);
    expect(state.best).toBe(0);
    expect(state.choice).toBeUndefined();

    const full = { ...state, grid: new Array<number>(COLS * ROWS).fill(1) };
    expect(fire(full, 0)).toEqual({ ok: false, reason: 'column_full' });
  });

  it('daily is the classic rules on a date; the jam sets the best', () => {
    const start = newGame(7, 0, 'daily', { dailyDate: '2026-11-08' });
    expect(start.mode).toBe('daily');
    const { state } = play(start, 2);
    expect(state.mode).toBe('daily');
    expect(state.daily).toEqual({ date: '2026-11-08' });
    expect(state.score).toBe(0);
  });
});

describe('saves', () => {
  it('upgrades a v2 classic save to v3 without the mode fields', () => {
    const game = newGame(9);
    const v2 = {
      ...game,
      version: 2,
      mode: undefined,
      ended: undefined,
      scrap: undefined,
      xp: undefined,
    };
    const restored = restore(JSON.parse(JSON.stringify(v2)));
    expect(restored?.version).toBe(3);
    expect(restored?.mode).toBe('classic');
    expect(restored?.seed).toBe(9);
    expect(restored?.orders).toBeUndefined();
    expect(restored?.daily).toBeUndefined();
  });

  it('restores an orders run and a daily, and refuses a broken one', () => {
    const run = newGame(1, 0, 'orders', { unlocked: [...PART_IDS] });
    const played = play(run, 2).state;
    expect(restore(JSON.parse(JSON.stringify(played)))).toEqual(played);
    const daily = play(newGame(1, 0, 'daily', { dailyDate: '2026-11-08' }), 2).state;
    expect(restore(JSON.parse(JSON.stringify(daily)))).toEqual(daily);
    expect(restore({ ...played, parts: ['nope'] })).toBeNull();
    expect(restore({ ...played, orderIndex: 99 })).toBeNull();
  });
});
