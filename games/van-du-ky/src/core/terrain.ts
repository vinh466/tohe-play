// Terrain on the hex board: two marked cells per side. A unit standing on a terrain cell gets one small stat
// bonus; the mark stays on the cell when it is open, so formation is a choice, not decoration.

import type { Column, Row, Stats } from './types.ts';

export type TerrainKind = 'stone' | 'ember' | 'gale' | 'tide';

export interface TerrainDef {
  readonly kind: TerrainKind;
  /** The short mark on the cell, e.g. `+DEF`. */
  readonly label: string;
  readonly stat: keyof Stats;
  /** Share of the base stat added while a unit stands here. */
  readonly value: number;
}

const TERRAIN: Record<TerrainKind, TerrainDef> = {
  stone: { kind: 'stone', label: '+DEF', stat: 'def', value: 0.12 },
  ember: { kind: 'ember', label: '+ATK', stat: 'atk', value: 0.08 },
  gale: { kind: 'gale', label: '+SPD', stat: 'spd', value: 0.08 },
  tide: { kind: 'tide', label: '+HP', stat: 'hp', value: 0.1 },
};

interface Mark {
  readonly row: Row;
  readonly column: Column;
  readonly terrain: TerrainKind;
}

/** Two marks per side. Keep them on cells the opening formation leaves open, except one enemy front cell. */
const MARKS: readonly (Mark & { readonly side: 'hero' | 'enemy' })[] = [
  { side: 'hero', row: 1, column: 1, terrain: 'ember' },
  { side: 'hero', row: 2, column: 0, terrain: 'stone' },
  { side: 'enemy', row: 0, column: 0, terrain: 'ember' },
  { side: 'enemy', row: 2, column: 2, terrain: 'stone' },
];

/** The terrain under a cell, if the board marks it. */
export function terrainAt(side: 'hero' | 'enemy', row: Row, column: Column): TerrainDef | undefined {
  const mark = MARKS.find((entry) => entry.side === side && entry.row === row && entry.column === column);
  return mark ? TERRAIN[mark.terrain] : undefined;
}

/** Apply a terrain mark to a unit's stats; absent terrain returns the same object. */
export function applyTerrain(stats: Stats, terrain: TerrainDef | undefined): Stats {
  if (!terrain) return stats;
  return { ...stats, [terrain.stat]: Math.round(stats[terrain.stat] * (1 + terrain.value)) };
}
