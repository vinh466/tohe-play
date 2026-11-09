import { defineCatalog } from '@tohe/game-kit';
import type { GearDef } from '../core/types.ts';

const gear = [
  {
    id: 'kiem-lua',
    name: 'Kiếm Lửa',
    slot: 'weapon',
    set: 'ember',
    rarity: 'rare',
    stat: 'atk',
    value: 18,
  },
  {
    id: 'kiem-da',
    name: 'Kiếm Đá',
    slot: 'weapon',
    set: 'stone',
    rarity: 'common',
    stat: 'atk',
    value: 14,
  },
  {
    id: 'giap-da',
    name: 'Giáp Đá',
    slot: 'armor',
    set: 'stone',
    rarity: 'rare',
    stat: 'hp',
    value: 140,
  },
  {
    id: 'giap-may',
    name: 'Giáp Mây',
    slot: 'armor',
    set: 'gale',
    rarity: 'common',
    stat: 'hp',
    value: 100,
  },
  {
    id: 'bua-lua',
    name: 'Bùa Lửa',
    slot: 'charm',
    set: 'ember',
    rarity: 'epic',
    stat: 'crit',
    value: 0.05,
  },
  {
    id: 'bua-nuoc',
    name: 'Bùa Nước',
    slot: 'charm',
    set: 'tide',
    rarity: 'rare',
    stat: 'hp',
    value: 120,
  },
  {
    id: 'di-vat-gio',
    name: 'Di Vật Gió',
    slot: 'relic',
    set: 'gale',
    rarity: 'rare',
    stat: 'spd',
    value: 8,
  },
  {
    id: 'di-vat-dat',
    name: 'Di Vật Đất',
    slot: 'relic',
    set: 'stone',
    rarity: 'common',
    stat: 'def',
    value: 12,
  },
] as const satisfies readonly GearDef[];

export const GEAR = defineCatalog('gear', gear);
export type GearId = (typeof gear)[number]['id'];
