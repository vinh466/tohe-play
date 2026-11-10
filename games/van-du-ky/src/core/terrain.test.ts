import { describe, expect, it } from 'vitest';
import { applyTerrain, terrainAt } from './terrain.ts';

describe('terrain', () => {
  it('marks two cells per side', () => {
    const marks = { hero: 0, enemy: 0 };
    for (const side of ['hero', 'enemy'] as const) {
      for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 4; column++) {
          if (terrainAt(side, row as 0 | 1 | 2, column as 0 | 1 | 2 | 3)) marks[side]++;
        }
      }
    }
    expect(marks).toEqual({ hero: 2, enemy: 2 });
  });

  it('applies a small bonus to the marked stat only', () => {
    const terrain = terrainAt('hero', 1, 1);
    expect(terrain?.label).toBe('+ATK');
    const base = { hp: 100, atk: 100, def: 100, spd: 100, crit: 0.1 };
    const next = applyTerrain(base, terrain);
    expect(next.atk).toBe(108);
    expect(next.hp).toBe(100);
    expect(next.def).toBe(100);
    expect(next.spd).toBe(100);
    expect(next.crit).toBe(0.1);
  });

  it('leaves an unmarked cell alone', () => {
    const base = { hp: 100, atk: 100, def: 100, spd: 100, crit: 0.1 };
    expect(applyTerrain(base, undefined)).toBe(base);
    expect(terrainAt('hero', 0, 0)).toBeUndefined();
  });
});
