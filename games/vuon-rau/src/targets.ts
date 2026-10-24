// What a tap means (SPEC.md, "A move"): the plot, the stall or Cô Ba nearest the finger, within reach — a tile is only
// about twenty CSS pixels on a phone held upright, smaller than a child's fingertip — or else the cell under it. Pure.
import { type Cell, keeper, MAP_COLS, MAP_ROWS, plots, stall } from './content/map.ts';

/** How far from a target's centre a tap still reaches it, in tiles. */
export const REACH = 0.85;

export type Target =
  | { kind: 'plot'; index: number; cell: Cell }
  | { kind: 'stall'; cell: Cell }
  | { kind: 'keeper'; cell: Cell }
  | { kind: 'cell'; cell: Cell };

/** The target of a tap at `point`, a point of the world in tiles (fractions); null outside the map. */
export function targetAt(point: { x: number; y: number }): Target | null {
  if (!(point.x >= 0 && point.y >= 0 && point.x < MAP_COLS && point.y < MAP_ROWS)) return null;
  const candidates: Target[] = [
    ...plots.map((cell, index) => ({ kind: 'plot' as const, index, cell })),
    ...stall.map((cell) => ({ kind: 'stall' as const, cell })),
    { kind: 'keeper', cell: keeper },
  ];
  let best: Target | null = null;
  let nearest = REACH;
  for (const target of candidates) {
    const distance = Math.hypot(point.x - (target.cell.x + 0.5), point.y - (target.cell.y + 0.5));
    if (distance <= nearest) {
      nearest = distance;
      best = target;
    }
  }
  return best ?? { kind: 'cell', cell: { x: Math.floor(point.x), y: Math.floor(point.y) } };
}
