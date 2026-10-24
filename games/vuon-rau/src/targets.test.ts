import { describe, expect, it } from 'vitest';
import { keeper, plots, stall } from './content/map.ts';
import { targetAt } from './targets.ts';

const centreOf = (cell: { x: number; y: number }) => ({ x: cell.x + 0.5, y: cell.y + 0.5 });

describe('what a tap means', () => {
  it('takes the plot, the stall or Cô Ba under the finger', () => {
    for (const [index, cell] of plots.entries()) {
      expect(targetAt(centreOf(cell))).toEqual({ kind: 'plot', index, cell });
    }
    for (const crate of stall) expect(targetAt(centreOf(crate))).toEqual({ kind: 'stall', cell: crate });
    expect(targetAt(centreOf(keeper))).toEqual({ kind: 'keeper', cell: keeper });
  });

  it('reaches a plot from the path beside it, so a child’s finger need not be exact', () => {
    const first = plots[0] as { x: number; y: number };
    expect(targetAt({ x: first.x + 0.5, y: first.y + 1.3 })).toMatchObject({ kind: 'plot', index: 0 });
    expect(targetAt({ x: first.x + 0.5, y: first.y - 0.3 })).toMatchObject({ kind: 'plot', index: 0 });
  });

  it('picks the nearest of two plots side by side', () => {
    const first = plots[0] as { x: number; y: number };
    expect(targetAt({ x: first.x + 0.9, y: first.y + 0.5 })).toMatchObject({ kind: 'plot', index: 0 });
    expect(targetAt({ x: first.x + 1.1, y: first.y + 0.5 })).toMatchObject({ kind: 'plot', index: 1 });
  });

  it('is the cell under the finger far from anything, and nothing outside the map', () => {
    expect(targetAt({ x: 0.5, y: 5.5 })).toEqual({ kind: 'cell', cell: { x: 0, y: 5 } });
    expect(targetAt({ x: -0.1, y: 3 })).toBeNull();
    expect(targetAt({ x: 16, y: 3 })).toBeNull();
  });
});
