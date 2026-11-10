import { defineCatalog } from '@tohe/game-kit';
import type { Column, RegionDef, Row, StageDef, StageEnemy } from '../core/types.ts';
import { GEAR } from './gear.ts';

const e = (enemyId: string, row: Row, column: Column, level: number): StageEnemy => ({
  enemyId,
  row,
  column,
  level,
});

interface RegionPlan {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly palette: readonly string[];
  /** Six regular enemies: vanguard, blade, binder, seer, blade, seer. */
  readonly pool: readonly string[];
  readonly boss: string;
}

export const REGION_PLANS: readonly RegionPlan[] = [
  {
    id: 'doi-suong',
    name: 'Đồi Sương',
    blurb: 'Con đường đầu tiên, sương phủ kín lối. Đoàn đi qua tiếng chuông của người xưa.',
    palette: ['#171614', '#2d1f1c', '#456c4e', '#d8a84e'],
    pool: ['sen-da', 'doi-lua', 'bun-non', 'may-xam', 'soi-tro', 'phu-thuy'],
    boss: 'sen-da-co',
  },
  {
    id: 'rung-tro',
    name: 'Rừng Tro',
    blurb: 'Rừng cây cháy dở, tro bay như tuyết. Ở đây, lửa không bao giờ tắt hẳn.',
    palette: ['#151210', '#3a2018', '#7a3a24', '#e0a34e'],
    pool: ['quai-da', 'ma-lua', 'ca-bay', 'chim-gio', 're-cay', 'xac-uot'],
    boss: 'vua-re',
  },
  {
    id: 'ho-muoi',
    name: 'Hồ Muối',
    blurb: 'Hồ nước mặn đến mức đá cũng khô. Muối kết thành những con đường trắng.',
    palette: ['#101518', '#1e3036', '#3f6f7a', '#d8d2bd'],
    pool: ['lua-ma', 'gio-doc', 'da-lan', 'song-du', 'tro-bay', 'mua-da'],
    boss: 'nua-lua',
  },
  {
    id: 'deo-gio',
    name: 'Đèo Gió',
    blurb: 'Đèo cao nhất, gió đổi chiều mỗi bước. Trên đỉnh, biển mây che cả bầu trời.',
    palette: ['#121414', '#24302c', '#4d7666', '#c8d8c8'],
    pool: ['xoay-gio', 'bong-toi', 'da-lan', 'chim-gio', 'ma-lua', 'mua-da'],
    boss: 'nuoc-lon',
  },
];

const regionDefs: readonly RegionDef[] = REGION_PLANS.map((plan) => ({
  id: plan.id,
  name: plan.name,
  blurb: plan.blurb,
  palette: plan.palette,
}));

/** Every cell on one side of the board: three ranks × four lanes. */
export const ALL_SLOTS: readonly { readonly row: Row; readonly column: Column }[] = [0, 1, 2].flatMap((row) =>
  [0, 1, 2, 3].map((column) => ({ row: row as Row, column: column as Column })),
);

/** The six slots a wave fills first: two front, two mid and two back, spread across the lanes. */
export const DEPLOY_SLOTS: readonly { readonly row: Row; readonly column: Column }[] = [
  { row: 0, column: 0 },
  { row: 0, column: 2 },
  { row: 1, column: 1 },
  { row: 1, column: 3 },
  { row: 2, column: 0 },
  { row: 2, column: 2 },
];

/** How many enemies each wave of a stage holds; stage 12's last wave is the boss plus two escorts. */
function waveSizes(index: number): readonly number[] {
  if (index === 1) return [3];
  if (index <= 3) return [3, 3];
  if (index === 4) return [4, 4];
  if (index <= 7) return [4, 5];
  if (index === 8) return [5, 6];
  if (index <= 11) return [6, 6];
  return [5, 3];
}

function waveOf(plan: RegionPlan, index: number, wave: number, size: number, level: number): StageEnemy[] {
  return DEPLOY_SLOTS.slice(0, size).map((slot, offset) => {
    const id = plan.pool[(index + wave * 2 + offset) % plan.pool.length] as string;
    return e(id, slot.row, slot.column, level);
  });
}

function stageOf(plan: RegionPlan, regionNumber: number, index: number, offset: number): StageDef {
  // One global curve, not one per region: early stages stay gentle, the last region climbs fast.
  const level = 1 + Math.floor(offset * 0.38 + Math.max(0, offset - 16) * 0.32);
  const sizes = waveSizes(index);
  const waves = sizes.map((size, wave) => {
    if (index === 12 && wave === 1) {
      return {
        boss: true,
        enemies: [
          e(plan.boss, 0, 1, level + 1),
          e(plan.pool[2] as string, 2, 0, level),
          e(plan.pool[3] as string, 2, 3, level),
        ],
      };
    }
    return {
      enemies: waveOf(plan, index, wave, size, level),
      ...(index === 4 || index === 8 ? { elite: true } : {}),
    };
  });
  const gear = index % 4 === 0 ? GEAR.items[offset % GEAR.items.length] : undefined;
  return {
    id: `${regionNumber}-${index}`,
    region: plan.id,
    index,
    waves,
    recommendedPower: Math.round(5100 + offset * 300 + offset * offset * 2.2),
    ...(index === 12 ? { rounds: 40 } : {}),
    firstClear: {
      gold: 140 + offset * 28,
      essence: 10 + offset * 2,
      shards: 4 + Math.floor(offset / 4),
    },
    loot: {
      gold: 55 + offset * 14,
      essence: 3 + Math.floor(offset * 0.9),
      shardChance: Math.min(0.48, 0.2 + offset * 0.006),
      ...(gear ? { gear: gear.id } : {}),
    },
    ...(index === 4 || index === 8 ? { elite: true } : {}),
    ...(index === 12 ? { boss: true } : {}),
  };
}

const stages: readonly StageDef[] = REGION_PLANS.flatMap((plan, regionIndex) =>
  Array.from({ length: 12 }, (_, index) =>
    stageOf(plan, regionIndex + 1, index + 1, regionIndex * 12 + index),
  ),
);

export const REGIONS = defineCatalog('region', regionDefs);
export const STAGES = defineCatalog('stage', stages);
export type StageId = (typeof stages)[number]['id'];

/** The region number of a stage (`1`–`4`), or 0 when the id is unknown. */
export function regionNumber(stageId: string): number {
  return Number(stageId.split('-')[0]) || 0;
}

/** The first stage of a region. */
export function regionStart(region: number): StageDef | undefined {
  return STAGES.items[(Math.max(1, Math.min(4, region)) - 1) * 12];
}

/** A stage by id, or a clear error; the UI and sim use ids from the save and the road. */
export function stageById(id: string): StageDef {
  const stage = STAGES.items.find((candidate) => candidate.id === id);
  if (!stage) throw new Error(`stage: no stage with id "${id}"`);
  return stage;
}
