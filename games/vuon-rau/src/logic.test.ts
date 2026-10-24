import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type CropId, crops, stageMs } from './content/crops.ts';
import {
  basketValue,
  buy,
  type GameEvent,
  harvest,
  newGame,
  nextStep,
  PLOTS,
  type Plot,
  plant,
  plotInfo,
  type Result,
  restore,
  START_COINS,
  type State,
  sell,
  shownStage,
  tick,
  till,
  water,
} from './logic.ts';

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 9, 25, 8, 0, 0);

function ok(result: Result): { state: State; events: GameEvent[] } {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result;
}

/** A farm with a carrot planted on plot 0 at T0. */
function planted(crop: CropId = 'carrot'): State {
  const tilled = ok(till(newGame(), 0, T0)).state;
  const withSeed = { ...tilled, seeds: { ...tilled.seeds, [crop]: 1 } };
  return ok(plant(withSeed, 0, crop, T0)).state;
}

describe('a new farm', () => {
  it('starts with 10 coins, 3 carrot seeds and twelve plots of grass', () => {
    const state = newGame();
    expect(state.coins).toBe(START_COINS);
    expect(state.seeds).toEqual({ carrot: 3, tomato: 0, wheat: 0 });
    expect(state.plots).toHaveLength(PLOTS);
    expect(state.plots.every((plot) => nextStep(plot) === 'till')).toBe(true);
  });
});

describe('a plot, tap by tap', () => {
  it('goes grass → tilled → planted → watered, and refuses the wrong step', () => {
    let state = newGame();
    expect(plant(state, 0, 'carrot', T0)).toEqual({ ok: false, reason: 'not_tilled' });
    state = ok(till(state, 0, T0)).state;
    expect(till(state, 0, T0)).toEqual({ ok: false, reason: 'not_grass' });
    expect(plant(state, 0, 'tomato', T0)).toEqual({ ok: false, reason: 'no_seed' });
    const sown = ok(plant(state, 0, 'carrot', T0));
    expect(sown.events).toEqual([{ type: 'planted', plot: 0, crop: 'carrot' }]);
    expect(sown.state.seeds.carrot).toBe(2);
    expect(nextStep(sown.state.plots[0] as Plot)).toBe('water');
    const wet = ok(water(sown.state, 0, T0));
    expect(nextStep(wet.state.plots[0] as Plot)).toBe('wait');
    expect(water(wet.state, 0, T0)).toEqual({ ok: false, reason: 'not_dry' });
    expect(harvest(wet.state, 0, T0)).toEqual({ ok: false, reason: 'not_ripe' });
  });

  it('refuses a plot that does not exist', () => {
    for (const index of [-1, PLOTS, 1.5, Number.NaN]) {
      expect(till(newGame(), index, T0)).toEqual({ ok: false, reason: 'no_such_plot' });
    }
  });
});

describe('growing', () => {
  it('passes one stage per watering after its time, then waits for water again', () => {
    const each = stageMs(crops.get('carrot'));
    expect(each).toBe(MINUTE);
    let state = ok(water(planted(), 0, T0)).state;
    expect(tick(state, T0 + each - 1).events).toEqual([]);
    const grown = tick(state, T0 + each);
    expect(grown.events).toEqual([{ type: 'grew', plot: 0, crop: 'carrot', stage: 1 }]);
    state = grown.state;
    // Dry: hours pass and nothing happens — it waits, it never dies.
    expect(tick(state, T0 + 10 * 60 * MINUTE).events).toEqual([]);
    expect(nextStep(state.plots[0] as Plot)).toBe('water');
  });

  it('ripens after its time when every stage is watered at once: 3, 15 and 60 minutes', () => {
    for (const [crop, minutes] of [
      ['carrot', 3],
      ['tomato', 15],
      ['wheat', 60],
    ] as const) {
      let state = planted(crop);
      let now = T0;
      const each = stageMs(crops.get(crop));
      for (let stage = 0; stage < crops.get(crop).stages; stage++) {
        state = ok(water(state, 0, now)).state;
        now += each;
        state = tick(state, now).state;
      }
      expect(now - T0).toBe(minutes * MINUTE);
      expect(state.plots[0]?.s).toBe('ripe');
    }
  });

  it('brings the growth up to the time of an action, first in its events', () => {
    const state = ok(water(planted(), 0, T0)).state;
    const later = ok(till(state, 1, T0 + MINUTE));
    expect(later.events.map((event) => event.type)).toEqual(['grew', 'tilled']);
  });

  it('never goes back when the clock does', () => {
    const state = ok(water(planted(), 0, T0)).state;
    expect(tick(state, T0 - 60 * MINUTE)).toEqual({ state, events: [] });
  });

  it('tells how long until ripe and what it shows', () => {
    let state = planted('tomato');
    expect(plotInfo(state.plots[0] as Plot, T0).remainingMs).toBe(15 * MINUTE);
    state = ok(water(state, 0, T0)).state;
    expect(plotInfo(state.plots[0] as Plot, T0 + 2 * MINUTE).remainingMs).toBe(13 * MINUTE);
    expect(shownStage(state.plots[0] as Plot)).toBe(0);
    expect(plotInfo({ s: 'grass' }, T0)).toEqual({ crop: null, step: 'till', remainingMs: null });
  });
});

describe('harvest and the stall', () => {
  it('harvests one crop into the basket, leaves the plot tilled, and celebrates only the first of a crop', () => {
    let state = planted();
    let now = T0;
    for (let stage = 0; stage < 3; stage++) {
      state = ok(water(state, 0, now)).state;
      now += MINUTE;
    }
    const first = ok(harvest(state, 0, now));
    expect(first.events.at(-1)).toEqual({ type: 'harvested', plot: 0, crop: 'carrot', first: true });
    expect(first.state.basket.carrot).toBe(1);
    expect(first.state.plots[0]).toEqual({ s: 'tilled' });
    expect(first.state.harvested).toEqual(['carrot']);
  });

  it('sells the whole basket and buys seeds while the coins last', () => {
    const state: State = { ...newGame(), coins: 3, basket: { carrot: 2, tomato: 1, wheat: 0 } };
    expect(basketValue(state)).toBe(24);
    const sold = ok(sell(state, T0));
    expect(sold.state.coins).toBe(27);
    expect(sold.state.basket).toEqual({ carrot: 0, tomato: 0, wheat: 0 });
    expect(sell(sold.state, T0)).toEqual({ ok: false, reason: 'nothing_to_sell' });
    const bought = ok(buy(sold.state, 'wheat', T0));
    expect(bought.state.coins).toBe(19);
    expect(bought.state.seeds.wheat).toBe(1);
    expect(buy({ ...bought.state, coins: 7 }, 'wheat', T0)).toEqual({ ok: false, reason: 'no_coins' });
  });
});

describe('saves', () => {
  it('restore only farms this version reads', () => {
    const state = ok(water(planted(), 0, T0)).state;
    expect(restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(restore(null)).toBeNull();
    expect(restore({ ...state, v: 2 })).toBeNull();
    expect(restore({ ...state, coins: -1 })).toBeNull();
    expect(restore({ ...state, plots: state.plots.slice(1) })).toBeNull();
    expect(
      restore({ ...state, plots: [{ s: 'growing', crop: 'mango' }, ...state.plots.slice(1)] }),
    ).toBeNull();
    expect(
      restore({
        ...state,
        plots: [
          { s: 'growing', crop: 'carrot', stage: 3, plantedAt: T0, wateredAt: null },
          ...state.plots.slice(1),
        ],
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------- the bot

type Action =
  /** What a tap does: the plot's next step, planting the first crop the player has a seed of. */
  | { kind: 'tap'; plot: number; wait: number }
  | { kind: 'till' | 'water' | 'harvest'; plot: number; wait: number }
  | { kind: 'plant'; plot: number; crop: CropId; wait: number }
  | { kind: 'sell'; wait: number }
  | { kind: 'buy'; crop: CropId; wait: number }
  | { kind: 'tick'; wait: number };

const plotArb = fc.integer({ min: 0, max: PLOTS - 1 });
// Taps come back to a few plots, as a child tends one bed: enough watering in a row for crops to ripen.
const tapPlotArb = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 2 }) },
  { weight: 1, arbitrary: plotArb },
);
const cropArb = fc.constantFrom(...crops.ids);
// Mostly short waits, sometimes long ones (a game closed for a while), sometimes the clock turned back.
const waitArb = fc.oneof(
  { weight: 6, arbitrary: fc.integer({ min: 0, max: 2 * MINUTE }) },
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 90 * MINUTE }) },
  { weight: 1, arbitrary: fc.integer({ min: -30 * MINUTE, max: 0 }) },
);
const actionArb: fc.Arbitrary<Action> = fc.oneof(
  { weight: 12, arbitrary: fc.record({ kind: fc.constant('tap'), plot: tapPlotArb, wait: waitArb }) },
  fc.record({ kind: fc.constantFrom('till', 'water', 'harvest'), plot: plotArb, wait: waitArb }),
  fc.record({ kind: fc.constant('plant'), plot: plotArb, crop: cropArb, wait: waitArb }),
  fc.record({ kind: fc.constant('sell'), wait: waitArb }),
  fc.record({ kind: fc.constant('buy'), crop: cropArb, wait: waitArb }),
  fc.record({ kind: fc.constant('tick'), wait: waitArb }),
) as fc.Arbitrary<Action>;

function apply(state: State, action: Action, now: number): Result {
  switch (action.kind) {
    case 'tap': {
      const plot = tick(state, now).state.plots[action.plot] as Plot;
      const step = nextStep(plot);
      if (step === 'till') return till(state, action.plot, now);
      if (step === 'plant') {
        const crop = crops.ids.find((id) => state.seeds[id] > 0);
        return crop ? plant(state, action.plot, crop, now) : buy(state, 'carrot', now);
      }
      if (step === 'water') return water(state, action.plot, now);
      if (step === 'harvest') return harvest(state, action.plot, now);
      return { ok: true, ...tick(state, now) };
    }
    case 'till':
      return till(state, action.plot, now);
    case 'plant':
      return plant(state, action.plot, action.crop, now);
    case 'water':
      return water(state, action.plot, now);
    case 'harvest':
      return harvest(state, action.plot, now);
    case 'sell':
      return sell(state, now);
    case 'buy':
      return buy(state, action.crop, now);
    case 'tick':
      return { ok: true, ...tick(state, now) };
  }
}

/** How far along a plot is: grass, tilled, each growing stage, ripe — to check it never goes back while it grows. */
const progress = (plot: Plot) =>
  plot.s === 'growing' ? plot.stage : plot.s === 'ripe' ? crops.get(plot.crop).stages : -1;

function play(actions: Action[]) {
  let state = newGame();
  let now = T0;
  const log: GameEvent[][] = [];
  for (const action of actions) {
    now += action.wait;
    const before = state;
    const snapshot = JSON.stringify(before);
    const result = apply(state, action, now);
    // Pure: the state given is never changed, whether the action is refused or not.
    expect(JSON.stringify(before)).toBe(snapshot);
    if (!result.ok) continue;
    state = result.state;
    log.push(result.events);

    // Coins never go below zero, and a purchase needs enough coins.
    expect(state.coins).toBeGreaterThanOrEqual(0);
    for (const crop of crops.ids) {
      expect(state.seeds[crop]).toBeGreaterThanOrEqual(0);
      expect(state.basket[crop]).toBeGreaterThanOrEqual(0);
    }
    // A plot holds at most one crop, and a crop never goes back while it grows.
    expect(state.plots).toHaveLength(PLOTS);
    for (const [index, plot] of state.plots.entries()) {
      const was = before.plots[index] as Plot;
      const harvested = result.events.some((event) => event.type === 'harvested' && event.plot === index);
      if ((was.s === 'growing' || was.s === 'ripe') && !harvested) {
        expect(plot.s === 'growing' || plot.s === 'ripe').toBe(true);
        expect(progress(plot)).toBeGreaterThanOrEqual(progress(was));
      }
    }
    for (const event of result.events) {
      // A stage passes only once watered: the plot had been watered in the stage it leaves.
      if (event.type === 'grew' || event.type === 'ripened') {
        const was = before.plots[event.plot];
        expect(was?.s).toBe('growing');
        if (was?.s === 'growing') expect(was.wateredAt).not.toBeNull();
      }
      // Harvest happens only when ripe and moves exactly one crop to the basket.
      if (event.type === 'harvested') {
        const ripeBefore = tick(before, now).state.plots[event.plot];
        expect(ripeBefore?.s).toBe('ripe');
        expect(state.basket[event.crop]).toBe(tick(before, now).state.basket[event.crop] + 1);
      }
      if (event.type === 'bought') expect(before.coins).toBeGreaterThanOrEqual(event.price);
    }
    // The save restores the same farm.
    expect(restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
  }
  return { state, log };
}

describe('random play (bot)', () => {
  it('keeps every invariant from SPEC.md, and the same actions at the same times give the same farm', () => {
    const seen = new Set<GameEvent['type']>();
    fc.assert(
      // `size: 'max'`: long games — fast-check keeps arrays to about ten items otherwise, too few for a crop to ripen.
      fc.property(fc.array(actionArb, { minLength: 20, maxLength: 200, size: 'max' }), (actions) => {
        const first = play(actions);
        const again = play(actions);
        expect(again).toEqual(first);
        for (const events of first.log) for (const event of events) seen.add(event.type);
      }),
      { numRuns: 60, endOnFailure: true },
    );
    // The bot reaches every kind of event, harvests and sales included: the invariants were checked where they matter.
    expect([...seen].sort()).toEqual([
      'bought',
      'grew',
      'harvested',
      'planted',
      'ripened',
      'sold',
      'tilled',
      'watered',
    ]);
  }, 20_000);
});
