// Vườn Rau rules (SPEC.md). Pure: no DOM, no timers, no Date.now — every action takes the time as an argument, so a
// saved farm resumes exactly and the same actions at the same times replay exactly. An action returns the new state and
// the events that happened, in order; the view animates those events and never decides rules itself.
//
// A crop grows through its stages; each stage starts once it is watered and passes after its time (crops.ts). A dry
// crop waits — it never dies — and the time it waits does not count. The last stage passed, the crop is ripe.
import { type Crop, type CropId, crops, stageMs } from './content/crops.ts';

export type { CropId } from './content/crops.ts';

export const PLOTS = 12;
export const START_COINS = 10;
export const START_SEEDS: Readonly<Record<CropId, number>> = { carrot: 3, tomato: 0, wheat: 0 };

export type Plot =
  | { s: 'grass' }
  | { s: 'tilled' }
  /** Growing in `stage` (0 is the first); `wateredAt` is when this stage was watered, null while it waits for water. */
  | { s: 'growing'; crop: CropId; stage: number; plantedAt: number; wateredAt: number | null }
  | { s: 'ripe'; crop: CropId; plantedAt: number };

export type Counts = Record<CropId, number>;

export interface State {
  v: 1;
  coins: number;
  basket: Counts;
  seeds: Counts;
  plots: Plot[];
  /** Crops harvested at least once: the first harvest of each is a small celebration. */
  harvested: CropId[];
}

export type GameEvent =
  | { type: 'tilled'; plot: number }
  | { type: 'planted'; plot: number; crop: CropId }
  | { type: 'watered'; plot: number; crop: CropId; stage: number }
  /** A stage passed and the next one waits for water. */
  | { type: 'grew'; plot: number; crop: CropId; stage: number }
  | { type: 'ripened'; plot: number; crop: CropId }
  | { type: 'harvested'; plot: number; crop: CropId; first: boolean }
  | { type: 'sold'; coins: number; items: { crop: CropId; count: number }[] }
  | { type: 'bought'; crop: CropId; price: number };

export type Refusal =
  | 'no_such_plot'
  | 'no_such_crop'
  | 'not_grass'
  | 'not_tilled'
  | 'no_seed'
  | 'not_dry'
  | 'not_ripe'
  | 'nothing_to_sell'
  | 'no_coins';

export type Result = { ok: true; state: State; events: GameEvent[] } | { ok: false; reason: Refusal };

/** What a tap on the plot does next (SPEC.md, "A move"). */
export type NextStep = 'till' | 'plant' | 'water' | 'wait' | 'harvest';

const noCrops = (): Counts => ({ carrot: 0, tomato: 0, wheat: 0 });

export function newGame(): State {
  return {
    v: 1,
    coins: START_COINS,
    basket: noCrops(),
    seeds: { ...START_SEEDS },
    plots: Array.from({ length: PLOTS }, () => ({ s: 'grass' }) as Plot),
    harvested: [],
  };
}

export function nextStep(plot: Plot): NextStep {
  switch (plot.s) {
    case 'grass':
      return 'till';
    case 'tilled':
      return 'plant';
    case 'growing':
      return plot.wateredAt === null ? 'water' : 'wait';
    case 'ripe':
      return 'harvest';
  }
}

/**
 * Brings every crop up to `now`: a watered stage whose time has passed moves on — to the next stage, which waits for
 * water, or to ripe. A clock turned back changes nothing (a stage never goes back).
 */
export function tick(state: State, now: number): { state: State; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let plots: Plot[] | null = null;
  state.plots.forEach((plot, index) => {
    if (plot.s !== 'growing' || plot.wateredAt === null) return;
    const crop = crops.get(plot.crop);
    if (now - plot.wateredAt < stageMs(crop)) return;
    plots ??= [...state.plots];
    const stage = plot.stage + 1;
    if (stage >= crop.stages) {
      plots[index] = { s: 'ripe', crop: plot.crop, plantedAt: plot.plantedAt };
      events.push({ type: 'ripened', plot: index, crop: plot.crop });
    } else {
      plots[index] = { ...plot, stage, wateredAt: null };
      events.push({ type: 'grew', plot: index, crop: plot.crop, stage });
    }
  });
  return { state: plots ? { ...state, plots } : state, events };
}

/** Runs an action on the state brought up to `now`; the growth that happened meanwhile comes first in the events. */
function act(state: State, now: number, action: (current: State) => Result): Result {
  const ticked = tick(state, now);
  const result = action(ticked.state);
  if (!result.ok) return result;
  return { ok: true, state: result.state, events: [...ticked.events, ...result.events] };
}

const withPlot = (state: State, index: number, plot: Plot): State => {
  const plots = [...state.plots];
  plots[index] = plot;
  return { ...state, plots };
};

const plotAt = (state: State, index: number): Plot | null =>
  Number.isInteger(index) && index >= 0 && index < state.plots.length ? (state.plots[index] ?? null) : null;

export function till(state: State, index: number, now: number): Result {
  return act(state, now, (current) => {
    const plot = plotAt(current, index);
    if (!plot) return { ok: false, reason: 'no_such_plot' };
    if (plot.s !== 'grass') return { ok: false, reason: 'not_grass' };
    return {
      ok: true,
      state: withPlot(current, index, { s: 'tilled' }),
      events: [{ type: 'tilled', plot: index }],
    };
  });
}

export function plant(state: State, index: number, crop: CropId, now: number): Result {
  return act(state, now, (current) => {
    const plot = plotAt(current, index);
    if (!plot) return { ok: false, reason: 'no_such_plot' };
    if (!crops.has(crop)) return { ok: false, reason: 'no_such_crop' };
    if (plot.s !== 'tilled') return { ok: false, reason: 'not_tilled' };
    if (current.seeds[crop] <= 0) return { ok: false, reason: 'no_seed' };
    const next = withPlot(current, index, { s: 'growing', crop, stage: 0, plantedAt: now, wateredAt: null });
    return {
      ok: true,
      state: { ...next, seeds: { ...current.seeds, [crop]: current.seeds[crop] - 1 } },
      events: [{ type: 'planted', plot: index, crop }],
    };
  });
}

export function water(state: State, index: number, now: number): Result {
  return act(state, now, (current) => {
    const plot = plotAt(current, index);
    if (!plot) return { ok: false, reason: 'no_such_plot' };
    if (plot.s !== 'growing' || plot.wateredAt !== null) return { ok: false, reason: 'not_dry' };
    return {
      ok: true,
      state: withPlot(current, index, { ...plot, wateredAt: now }),
      events: [{ type: 'watered', plot: index, crop: plot.crop, stage: plot.stage }],
    };
  });
}

export function harvest(state: State, index: number, now: number): Result {
  return act(state, now, (current) => {
    const plot = plotAt(current, index);
    if (!plot) return { ok: false, reason: 'no_such_plot' };
    if (plot.s !== 'ripe') return { ok: false, reason: 'not_ripe' };
    const first = !current.harvested.includes(plot.crop);
    const next = withPlot(current, index, { s: 'tilled' });
    return {
      ok: true,
      state: {
        ...next,
        basket: { ...current.basket, [plot.crop]: current.basket[plot.crop] + 1 },
        harvested: first ? [...current.harvested, plot.crop] : current.harvested,
      },
      events: [{ type: 'harvested', plot: index, crop: plot.crop, first }],
    };
  });
}

/** Sells everything in the basket at the stall. */
export function sell(state: State, now: number): Result {
  return act(state, now, (current) => {
    const items = crops.ids
      .map((crop) => ({ crop, count: current.basket[crop] }))
      .filter((item) => item.count > 0);
    if (items.length === 0) return { ok: false, reason: 'nothing_to_sell' };
    const coins = items.reduce((sum, item) => sum + item.count * crops.get(item.crop).sellPrice, 0);
    return {
      ok: true,
      state: { ...current, coins: current.coins + coins, basket: noCrops() },
      events: [{ type: 'sold', coins, items }],
    };
  });
}

/** Buys one seed at the stall. */
export function buy(state: State, crop: CropId, now: number): Result {
  return act(state, now, (current) => {
    if (!crops.has(crop)) return { ok: false, reason: 'no_such_crop' };
    const price = crops.get(crop).seedPrice;
    if (current.coins < price) return { ok: false, reason: 'no_coins' };
    return {
      ok: true,
      state: {
        ...current,
        coins: current.coins - price,
        seeds: { ...current.seeds, [crop]: current.seeds[crop] + 1 },
      },
      events: [{ type: 'bought', crop, price }],
    };
  });
}

/** What a long press tells about a plot: the crop, and how long until it is ripe if every stage is watered at once. */
export interface PlotInfo {
  crop: Crop | null;
  step: NextStep;
  /** Milliseconds to ripe with no more waiting for water; 0 when ripe, null without a crop. */
  remainingMs: number | null;
}

export function plotInfo(plot: Plot, now: number): PlotInfo {
  if (plot.s === 'grass' || plot.s === 'tilled')
    return { crop: null, step: nextStep(plot), remainingMs: null };
  const crop = crops.get(plot.crop);
  if (plot.s === 'ripe') return { crop, step: 'harvest', remainingMs: 0 };
  const each = stageMs(crop);
  const left = crop.stages - plot.stage;
  const done = plot.wateredAt === null ? 0 : Math.min(each, Math.max(0, now - plot.wateredAt));
  return { crop, step: nextStep(plot), remainingMs: left * each - done };
}

/** The growing stage a plot shows (its picture), or null without a crop; a ripe crop shows its last stage. */
export function shownStage(plot: Plot): number | null {
  if (plot.s === 'growing') return plot.stage;
  if (plot.s === 'ripe') return crops.get(plot.crop).stages - 1;
  return null;
}

/** The value of the basket at the stall. */
export const basketValue = (state: State) =>
  crops.ids.reduce((sum, crop) => sum + state.basket[crop] * crops.get(crop).sellPrice, 0);

// ---------------------------------------------------------------------------------------------------- the save

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function readCounts(value: unknown): Counts | null {
  if (typeof value !== 'object' || value === null) return null;
  const counts = noCrops();
  for (const crop of crops.ids) {
    const count = (value as Record<string, unknown>)[crop] ?? 0;
    if (!isCount(count)) return null;
    counts[crop] = count;
  }
  return counts;
}

function readPlot(value: unknown): Plot | null {
  const plot = value as Record<string, unknown> | null;
  switch (plot?.s) {
    case 'grass':
    case 'tilled':
      return { s: plot.s };
    case 'growing': {
      const { crop, stage, plantedAt, wateredAt } = plot;
      if (typeof crop !== 'string' || !crops.has(crop) || !isTime(plantedAt)) return null;
      if (!isCount(stage) || stage >= crops.get(crop).stages) return null;
      if (wateredAt !== null && !isTime(wateredAt)) return null;
      return { s: 'growing', crop, stage, plantedAt, wateredAt };
    }
    case 'ripe': {
      const { crop, plantedAt } = plot;
      if (typeof crop !== 'string' || !crops.has(crop) || !isTime(plantedAt)) return null;
      return { s: 'ripe', crop, plantedAt };
    }
    default:
      return null;
  }
}

/** The farm in a save, or null when there is none or it is not one this version reads. */
export function restore(saved: unknown): State | null {
  const value = saved as Record<string, unknown> | null | undefined;
  if (value?.v !== 1 || !isCount(value.coins)) return null;
  const basket = readCounts(value.basket);
  const seeds = readCounts(value.seeds);
  if (!basket || !seeds || !Array.isArray(value.plots) || value.plots.length !== PLOTS) return null;
  const plots = value.plots.map(readPlot);
  if (plots.some((plot) => plot === null)) return null;
  // In the order they were first harvested, as saved; anything else dropped.
  const harvested = Array.isArray(value.harvested)
    ? [
        ...new Set(
          value.harvested.filter((crop): crop is CropId => typeof crop === 'string' && crops.has(crop)),
        ),
      ]
    : [];
  return { v: 1, coins: value.coins, basket, seeds, plots: plots as Plot[], harvested };
}
