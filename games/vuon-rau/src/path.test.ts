import { describe, expect, it } from 'vitest';
import { farmerStart, keeper, plots, stall } from './content/map.ts';
import { route, standCells, walkable } from './path.ts';

describe('walking the farm', () => {
  it('starts on a walkable cell', () => {
    expect(walkable(farmerStart)).toBe(true);
  });

  it('reaches a cell beside every plot, the stall and Cô Ba from the start', () => {
    for (const target of [...plots, ...stall, keeper]) {
      const stands = standCells(target);
      expect(stands.length, `${target.x},${target.y}`).toBeGreaterThan(0);
      expect(route(farmerStart, stands), `${target.x},${target.y}`).not.toBeNull();
    }
  });

  it('never steps on a plot, the stall or anything solid, one step at a time', () => {
    for (const target of plots) {
      const walk = route(farmerStart, standCells(target)) ?? [];
      let at = farmerStart;
      for (const step of walk) {
        expect(walkable(step)).toBe(true);
        expect(Math.abs(step.x - at.x) + Math.abs(step.y - at.y)).toBe(1);
        at = step;
      }
    }
  });

  it('takes a shortest walk, the same every time, and none when already there or unreachable', () => {
    const goal = { x: farmerStart.x, y: farmerStart.y + 2 };
    const walk = route(farmerStart, [goal]);
    expect(walk).toEqual([{ x: farmerStart.x, y: farmerStart.y + 1 }, goal]);
    expect(route(farmerStart, [goal])).toEqual(walk);
    expect(route(farmerStart, [farmerStart])).toEqual([]);
    expect(route(farmerStart, [plots[0] as { x: number; y: number }])).toBeNull();
  });
});
