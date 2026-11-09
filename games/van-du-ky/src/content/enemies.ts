import { defineCatalog } from '@tohe/game-kit';
import type { EnemyDef } from '../core/types.ts';

const enemies = [
  {
    id: 'sen-da',
    name: 'Sên Đá',
    role: 'vanguard',
    element: 'stone',
    base: { hp: 1100, atk: 70, def: 80, spd: 70, crit: 0.03 },
    basic: 'enemy-spit',
    active: 'enemy-slam',
  },
  {
    id: 'doi-lua',
    name: 'Dơi Lửa',
    role: 'blade',
    element: 'ember',
    base: { hp: 700, atk: 115, def: 40, spd: 105, crit: 0.08 },
    basic: 'enemy-claw',
    active: 'enemy-fire-ring',
  },
  {
    id: 'bun-non',
    name: 'Bùn Non',
    role: 'binder',
    element: 'tide',
    base: { hp: 850, atk: 85, def: 55, spd: 90, crit: 0.05 },
    basic: 'enemy-spit',
    active: 'enemy-hex',
  },
  {
    id: 'may-xam',
    name: 'Mây Xám',
    role: 'seer',
    element: 'gale',
    base: { hp: 750, atk: 80, def: 45, spd: 95, crit: 0.05 },
    basic: 'enemy-claw',
    active: 'enemy-mend',
  },
  {
    id: 'soi-tro',
    name: 'Sói Tro',
    role: 'blade',
    element: 'ember',
    base: { hp: 800, atk: 120, def: 45, spd: 100, crit: 0.1 },
    basic: 'enemy-claw',
    active: 'enemy-slam',
  },
  {
    id: 'phu-thuy',
    name: 'Phù Thủy',
    role: 'seer',
    element: 'tide',
    base: { hp: 780, atk: 95, def: 50, spd: 85, crit: 0.05 },
    basic: 'enemy-spit',
    active: 'enemy-mend',
  },
  {
    id: 'sen-da-co',
    name: 'Sên Đá Cổ',
    role: 'vanguard',
    element: 'stone',
    base: { hp: 4200, atk: 140, def: 120, spd: 75, crit: 0.05 },
    basic: 'enemy-slam',
    active: 'boss-quake',
    boss: true,
    immuneControl: true,
  },
] as const satisfies readonly EnemyDef[];

export const ENEMIES = defineCatalog('enemy', enemies);
export type EnemyId = (typeof enemies)[number]['id'];
