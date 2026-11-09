import type { Column, Row, StageDef, StageEnemy } from '../core/types.ts';
import { ENEMIES } from './enemies.ts';
import { REGION_PLANS } from './stages.ts';

const e = (enemyId: string, row: Row, column: Column, level: number): StageEnemy => ({
  enemyId,
  row,
  column,
  level,
});

const SLOTS: readonly { readonly row: Row; readonly column: Column }[] = [
  { row: 0, column: 0 },
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 1, column: 1 },
  { row: 2, column: 0 },
  { row: 2, column: 1 },
];

const BOSSES = ENEMIES.items.filter((enemy) => enemy.boss).map((enemy) => enemy.id);
const BOSS_NAMES = ENEMIES.items.filter((enemy) => enemy.boss).map((enemy) => enemy.name);

/** The tower's 40 floors: six cards, a boss every tenth floor, one modifier on every fifth. */
export function towerStage(floor: number): StageDef {
  const plan = REGION_PLANS[(floor - 1) % REGION_PLANS.length]!;
  const level = 1 + Math.floor(floor * 0.8);
  const bossFloor = floor % 10 === 0;
  const enemies = SLOTS.map((slot, index) => {
    if (bossFloor && index === 0) {
      const boss = BOSSES[Math.floor((floor - 1) / 10) % BOSSES.length]!;
      return e(boss, slot.row, slot.column, level + 2);
    }
    const id = plan.pool[(floor + index) % plan.pool.length] as string;
    return e(id, slot.row, slot.column, level);
  });
  return {
    id: `tower-${floor}`,
    region: plan.id,
    index: floor,
    waves: [
      {
        enemies,
        ...(bossFloor ? { boss: true } : {}),
        ...(floor % 5 === 0 ? { elite: true } : {}),
      },
    ],
    recommendedPower: 5200 + floor * 460,
    ...(bossFloor ? { rounds: 40 } : {}),
    firstClear: {
      gold: 120 + floor * 30,
      essence: 10 + floor * 3,
      shards: 4 + Math.floor(floor / 4),
    },
    loot: { gold: 0, essence: 0, shardChance: 0 },
    ...(floor % 5 === 0 ? { modifiers: ['Gió tháp: quái mạnh hơn'] } : {}),
    boss: bossFloor,
  } as StageDef;
}

/** The daily expedition: three waves from one region, scaled to the company. */
export function expeditionStage(day: number, companyLevel: number): StageDef {
  const plan = REGION_PLANS[Math.abs(day) % REGION_PLANS.length]!;
  const level = companyLevel + 1;
  const waves = [0, 1, 2].map((wave) => ({
    enemies: SLOTS.map((slot, index) =>
      e(plan.pool[(day + wave * 2 + index) % plan.pool.length] as string, slot.row, slot.column, level),
    ),
    ...(wave === 2 ? { elite: true } : {}),
  }));
  return {
    id: `expedition-${day}`,
    region: plan.id,
    index: 1,
    waves,
    recommendedPower: 4000 + companyLevel * 900,
    firstClear: {
      gold: 500 + companyLevel * 50,
      essence: 50 + companyLevel * 5,
      shards: 25,
    },
    loot: { gold: 0, essence: 0, shardChance: 0 },
    modifiers: ['Chuyến đi trong ngày'],
  };
}

/** The week's world boss: one boss and two escorts, a wall to measure damage against. */
export function bossStage(week: string, companyLevel: number): StageDef {
  const seed = [...week].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const boss = BOSSES[seed % BOSSES.length] as string;
  const plan = REGION_PLANS[seed % REGION_PLANS.length]!;
  const level = companyLevel + 6;
  return {
    id: `boss-${week}`,
    region: plan.id,
    index: 12,
    waves: [
      {
        boss: true,
        enemies: [
          e(boss, 0, 0, level),
          e(plan.pool[1] as string, 2, 0, level - 2),
          e(plan.pool[2] as string, 2, 1, level - 2),
        ],
      },
    ],
    recommendedPower: 9000 + companyLevel * 1200,
    rounds: 40,
    firstClear: { gold: 0, essence: 0, shards: 0 },
    loot: { gold: 0, essence: 0, shardChance: 0 },
    modifiers: ['Boss thế giới: đo sát thương'],
  };
}

/** The week's challenge: two waves, two declared modifiers, a local record for fewest rounds. */
export function challengeStage(week: string, companyLevel: number): StageDef {
  const seed = [...week].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const plan = REGION_PLANS[(seed + 1) % REGION_PLANS.length]!;
  const level = companyLevel + 3;
  const waves = [0, 1].map((wave) => ({
    enemies: SLOTS.map((slot, index) =>
      e(plan.pool[(seed + wave * 3 + index) % plan.pool.length] as string, slot.row, slot.column, level),
    ),
    ...(wave === 1 ? { elite: true } : {}),
  }));
  return {
    id: `challenge-${week}`,
    region: plan.id,
    index: 1,
    waves,
    recommendedPower: 7000 + companyLevel * 1000,
    rounds: 35,
    firstClear: { gold: 0, essence: 0, shards: 0 },
    loot: { gold: 0, essence: 0, shardChance: 0 },
    modifiers: ['Quái +3 cấp', 'Không hồi máu giữa hai đợt'],
  };
}

/** The name of the boss a week opens, for the daily sheet. */
export function bossName(week: string): string {
  const seed = [...week].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return BOSS_NAMES[seed % BOSS_NAMES.length] as string;
}
