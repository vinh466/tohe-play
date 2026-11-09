import { defineCatalog } from '@tohe/game-kit';
import type { RegionDef, StageDef, StageEnemy } from '../core/types.ts';

const e = (id: string, row: 0 | 1 | 2, column: 0 | 1, level: number): StageEnemy => ({
  enemyId: id,
  row,
  column,
  level,
});

const region: RegionDef = {
  id: 'doi-suong',
  name: 'Đồi Sương',
  palette: ['#171614', '#2d1f1c', '#456c4e', '#d8a84e'],
};

const stages = [
  {
    id: '1-1',
    region: 'doi-suong',
    index: 1,
    waves: [{ enemies: [e('sen-da', 0, 0, 1), e('doi-lua', 2, 1, 1), e('bun-non', 1, 0, 1)] }],
    recommendedPower: 5500,
    firstClear: { gold: 160, essence: 12, shards: 4 },
    loot: { gold: 70, essence: 4, shardChance: 0.2 },
  },
  {
    id: '1-2',
    region: 'doi-suong',
    index: 2,
    waves: [
      { enemies: [e('sen-da', 0, 0, 1), e('doi-lua', 2, 1, 1), e('may-xam', 2, 0, 1)] },
      { enemies: [e('bun-non', 1, 1, 1), e('soi-tro', 0, 1, 1), e('phu-thuy', 2, 0, 1)] },
    ],
    recommendedPower: 6200,
    firstClear: { gold: 180, essence: 14, shards: 4 },
    loot: { gold: 80, essence: 4, shardChance: 0.22 },
  },
  {
    id: '1-3',
    region: 'doi-suong',
    index: 3,
    waves: [
      { enemies: [e('sen-da', 0, 0, 2), e('doi-lua', 2, 1, 2), e('bun-non', 1, 0, 2)] },
      { enemies: [e('soi-tro', 0, 1, 2), e('may-xam', 2, 0, 2), e('phu-thuy', 2, 1, 2)] },
    ],
    recommendedPower: 6900,
    firstClear: { gold: 200, essence: 16, shards: 5 },
    loot: { gold: 90, essence: 5, shardChance: 0.24 },
  },
  {
    id: '1-4',
    region: 'doi-suong',
    index: 4,
    waves: [
      {
        enemies: [e('sen-da', 0, 0, 3), e('soi-tro', 0, 1, 3), e('doi-lua', 2, 0, 3), e('phu-thuy', 2, 1, 3)],
      },
      {
        enemies: [e('bun-non', 1, 0, 3), e('may-xam', 2, 0, 3), e('doi-lua', 0, 1, 3), e('sen-da', 1, 1, 3)],
      },
    ],
    elite: true,
    recommendedPower: 7800,
    firstClear: { gold: 240, essence: 20, shards: 6 },
    loot: { gold: 110, essence: 6, shardChance: 0.26, gear: 'giap-da' },
  },
  {
    id: '1-5',
    region: 'doi-suong',
    index: 5,
    waves: [
      {
        enemies: [e('sen-da', 0, 0, 4), e('bun-non', 0, 1, 4), e('doi-lua', 2, 0, 4), e('may-xam', 2, 1, 4)],
      },
      {
        enemies: [e('soi-tro', 0, 0, 4), e('phu-thuy', 1, 0, 4), e('doi-lua', 1, 1, 4), e('sen-da', 2, 0, 4)],
      },
    ],
    recommendedPower: 8800,
    firstClear: { gold: 270, essence: 22, shards: 6 },
    loot: { gold: 125, essence: 7, shardChance: 0.28 },
  },
  {
    id: '1-6',
    region: 'doi-suong',
    index: 6,
    waves: [
      {
        enemies: [
          e('sen-da', 0, 0, 4),
          e('soi-tro', 0, 1, 4),
          e('bun-non', 1, 0, 4),
          e('bun-non', 1, 1, 4),
          e('doi-lua', 2, 0, 4),
          e('phu-thuy', 2, 1, 4),
        ],
      },
      {
        enemies: [
          e('sen-da', 0, 0, 5),
          e('soi-tro', 0, 1, 5),
          e('may-xam', 1, 0, 5),
          e('phu-thuy', 1, 1, 5),
          e('doi-lua', 2, 0, 5),
          e('doi-lua', 2, 1, 5),
        ],
      },
    ],
    recommendedPower: 9800,
    firstClear: { gold: 300, essence: 24, shards: 7 },
    loot: { gold: 140, essence: 8, shardChance: 0.3, gear: 'bua-nuoc' },
  },
  {
    id: '1-7',
    region: 'doi-suong',
    index: 7,
    waves: [
      {
        enemies: [
          e('sen-da', 0, 0, 5),
          e('soi-tro', 0, 1, 5),
          e('bun-non', 1, 0, 5),
          e('may-xam', 1, 1, 5),
          e('doi-lua', 2, 0, 5),
          e('phu-thuy', 2, 1, 5),
        ],
      },
      {
        enemies: [
          e('sen-da', 0, 0, 6),
          e('soi-tro', 0, 1, 6),
          e('bun-non', 1, 0, 6),
          e('phu-thuy', 1, 1, 6),
          e('doi-lua', 2, 0, 6),
          e('doi-lua', 2, 1, 6),
        ],
      },
    ],
    recommendedPower: 10800,
    firstClear: { gold: 330, essence: 26, shards: 7 },
    loot: { gold: 155, essence: 9, shardChance: 0.32 },
  },
  {
    id: '1-8',
    region: 'doi-suong',
    index: 8,
    waves: [
      {
        enemies: [
          e('sen-da', 0, 0, 6),
          e('soi-tro', 0, 1, 6),
          e('bun-non', 1, 0, 6),
          e('may-xam', 1, 1, 6),
          e('doi-lua', 2, 0, 6),
          e('phu-thuy', 2, 1, 6),
        ],
      },
      {
        enemies: [
          e('sen-da', 0, 0, 7),
          e('soi-tro', 0, 1, 7),
          e('bun-non', 1, 0, 7),
          e('phu-thuy', 1, 1, 7),
          e('doi-lua', 2, 0, 7),
          e('soi-tro', 2, 1, 7),
        ],
      },
    ],
    elite: true,
    recommendedPower: 12000,
    firstClear: { gold: 370, essence: 30, shards: 8 },
    loot: { gold: 170, essence: 10, shardChance: 0.34, gear: 'di-vat-gio' },
  },
  {
    id: '1-9',
    region: 'doi-suong',
    index: 9,
    waves: [
      {
        enemies: [
          e('sen-da', 0, 0, 7),
          e('soi-tro', 0, 1, 7),
          e('bun-non', 1, 0, 7),
          e('may-xam', 1, 1, 7),
          e('doi-lua', 2, 0, 7),
          e('phu-thuy', 2, 1, 7),
        ],
      },
      {
        enemies: [
          e('sen-da', 0, 0, 8),
          e('soi-tro', 0, 1, 8),
          e('bun-non', 1, 0, 8),
          e('phu-thuy', 1, 1, 8),
          e('doi-lua', 2, 0, 8),
          e('doi-lua', 2, 1, 8),
        ],
      },
    ],
    recommendedPower: 13200,
    firstClear: { gold: 400, essence: 32, shards: 8 },
    loot: { gold: 185, essence: 11, shardChance: 0.36 },
  },
  {
    id: '1-10',
    region: 'doi-suong',
    index: 10,
    waves: [
      {
        enemies: [
          e('sen-da', 0, 0, 8),
          e('soi-tro', 0, 1, 8),
          e('bun-non', 1, 0, 8),
          e('may-xam', 1, 1, 8),
          e('doi-lua', 2, 0, 8),
          e('phu-thuy', 2, 1, 8),
        ],
      },
      {
        enemies: [
          e('sen-da', 0, 0, 9),
          e('soi-tro', 0, 1, 9),
          e('bun-non', 1, 0, 9),
          e('phu-thuy', 1, 1, 9),
          e('doi-lua', 2, 0, 9),
          e('soi-tro', 2, 1, 9),
        ],
      },
    ],
    recommendedPower: 14500,
    firstClear: { gold: 430, essence: 34, shards: 9 },
    loot: { gold: 200, essence: 12, shardChance: 0.38 },
  },
  {
    id: '1-11',
    region: 'doi-suong',
    index: 11,
    waves: [
      {
        enemies: [
          e('sen-da', 0, 0, 9),
          e('soi-tro', 0, 1, 9),
          e('bun-non', 1, 0, 9),
          e('may-xam', 1, 1, 9),
          e('doi-lua', 2, 0, 9),
          e('phu-thuy', 2, 1, 9),
        ],
      },
      {
        enemies: [
          e('sen-da', 0, 0, 10),
          e('soi-tro', 0, 1, 10),
          e('bun-non', 1, 0, 10),
          e('phu-thuy', 1, 1, 10),
          e('doi-lua', 2, 0, 10),
          e('soi-tro', 2, 1, 10),
        ],
      },
    ],
    recommendedPower: 15800,
    firstClear: { gold: 460, essence: 36, shards: 9 },
    loot: { gold: 215, essence: 13, shardChance: 0.4, gear: 'bua-lua' },
  },
  {
    id: '1-12',
    region: 'doi-suong',
    index: 12,
    waves: [
      {
        enemies: [
          e('sen-da', 0, 0, 10),
          e('soi-tro', 0, 1, 10),
          e('bun-non', 1, 0, 10),
          e('phu-thuy', 1, 1, 10),
          e('doi-lua', 2, 0, 10),
          e('doi-lua', 2, 1, 10),
        ],
      },
      { enemies: [e('sen-da-co', 0, 0, 10), e('phu-thuy', 2, 0, 10), e('may-xam', 2, 1, 10)] },
    ],
    boss: true,
    recommendedPower: 17500,
    firstClear: { gold: 600, essence: 50, shards: 12 },
    loot: { gold: 260, essence: 16, shardChance: 0.45, gear: 'giap-may' },
  },
] as const satisfies readonly StageDef[];

export const REGIONS = defineCatalog('region', [region]);
export const STAGES = defineCatalog('stage', stages);
export type StageId = (typeof stages)[number]['id'];
