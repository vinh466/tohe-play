// Dị Bản: a short, repeatable roguelite run. Six stops on the existing board; a relic at the start and one
// blessing after every stop. The run lives in the page, so no save schema changes.

import { createRng } from '../core/rng.ts';
import type { BattleModifier, Column, Row, StageDef, StageEnemy } from '../core/types.ts';
import { REGION_PLANS } from './stages.ts';

export type RiftNodeKind = 'battle' | 'elite' | 'event' | 'boss';

export interface RiftNode {
  readonly kind: RiftNodeKind;
  readonly label: string;
  readonly icon: string;
}

export const RIFT_NODES: readonly RiftNode[] = [
  { kind: 'battle', label: 'Cửa vào', icon: '⚔' },
  { kind: 'battle', label: 'Hành lang', icon: '⚔' },
  { kind: 'event', label: 'Miếu cổ', icon: '?' },
  { kind: 'elite', label: 'Thử thách', icon: '✦' },
  { kind: 'battle', label: 'Vực sâu', icon: '⚔' },
  { kind: 'boss', label: 'Chúa tể', icon: '☠' },
];

export interface RiftBlessing extends BattleModifier {
  readonly icon: string;
}

export const RIFT_BLESSINGS: readonly RiftBlessing[] = [
  { id: 'atk', name: 'Sắc Bén', note: '+18% ATK', icon: '⚔', stats: { atk: 0.18 } },
  { id: 'hp', name: 'Bền Bỉ', note: '+22% HP', icon: '♥', stats: { hp: 0.22 } },
  { id: 'def', name: 'Thạch Giáp', note: '+16% DEF', icon: '◈', stats: { def: 0.16 } },
  { id: 'spd', name: 'Lướt Gió', note: '+12% SPD', icon: '↯', stats: { spd: 0.12 } },
  { id: 'crit', name: 'Mắt Sáng', note: '+8% CRIT', icon: '✦', stats: { crit: 0.08 } },
  { id: 'lifesteal', name: 'Huyết Ẩm', note: 'Hút 12% sát thương', icon: '☾', lifesteal: 0.12 },
  { id: 'shield', name: 'Khiên Mở', note: 'Khiên 20% máu đầu trận', icon: '◈', startShield: 0.2 },
  { id: 'charge', name: 'Khai Linh', note: 'Chiêu sẵn từ đầu', icon: '✹', startCharge: true },
];

export const RIFT_RELICS: readonly RiftBlessing[] = [
  {
    id: 'relic-balance',
    name: 'Ấn Cân Bằng',
    note: '+10% HP · +10% ATK · +8% DEF',
    icon: '◉',
    stats: { hp: 0.1, atk: 0.1, def: 0.08 },
  },
  {
    id: 'relic-fury',
    name: 'Ấn Cuồng Phong',
    note: '+25% ATK · +8% SPD',
    icon: '✦',
    stats: { atk: 0.25, spd: 0.08 },
  },
  {
    id: 'relic-bulwark',
    name: 'Ấn Hộ Mệnh',
    note: '+30% HP · +12% DEF',
    icon: '◈',
    stats: { hp: 0.3, def: 0.12 },
  },
  {
    id: 'relic-ember',
    name: 'Ấn Khai Linh',
    note: 'Chiêu sẵn từ đầu · +8% CRIT',
    icon: '✹',
    startCharge: true,
    stats: { crit: 0.08 },
  },
];

export interface RiftRun {
  readonly seed: number;
  readonly nodes: readonly RiftNode[];
  index: number;
  relic: RiftBlessing | null;
  readonly blessings: RiftBlessing[];
}

export function createRiftRun(seed: number): RiftRun {
  return {
    seed: Math.abs(Math.floor(seed)) % 1_000_000_007,
    nodes: RIFT_NODES,
    index: 0,
    relic: null,
    blessings: [],
  };
}

function pick<T>(pool: readonly T[], count: number, seed: number): T[] {
  const rng = createRng(seed);
  const copy = [...pool];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = rng.int(index + 1);
    const value = copy[index] as T;
    copy[index] = copy[swap] as T;
    copy[swap] = value;
  }
  return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
}

/** Three relics for the start of a run. */
export function chooseRiftRelics(seed: number): RiftBlessing[] {
  return pick(RIFT_RELICS, 3, seed + 31);
}

/** Three blessings after a stop; owned blessings are not offered again while the pool lasts. */
export function chooseRiftBlessings(run: RiftRun): RiftBlessing[] {
  const owned = new Set(run.blessings.map((blessing) => blessing.id));
  const fresh = RIFT_BLESSINGS.filter((blessing) => !owned.has(blessing.id));
  const pool = fresh.length >= 3 ? fresh : RIFT_BLESSINGS;
  return pick(pool, 3, run.seed + run.index * 7919 + run.blessings.length * 131);
}

/** Relic + blessings, in the shape the pure battle core reads. */
export function riftModifiers(run: RiftRun | null): readonly BattleModifier[] {
  if (!run) return [];
  return [...(run.relic ? [run.relic] : []), ...run.blessings];
}

const e = (enemyId: string, row: Row, column: Column, level: number): StageEnemy => ({
  enemyId,
  row,
  column,
  level,
});

const SLOTS: readonly { readonly row: Row; readonly column: Column }[] = [
  { row: 0, column: 0 },
  { row: 0, column: 1 },
  { row: 0, column: 2 },
  { row: 0, column: 3 },
  { row: 1, column: 0 },
  { row: 1, column: 1 },
];

/** A deterministic stage for one stop; the view and the tests call the same function. */
export function riftStage(run: RiftRun, index: number, companyLevel: number): StageDef {
  const node = run.nodes[Math.max(0, Math.min(run.nodes.length - 1, index))] as RiftNode;
  const plan = REGION_PLANS[index % REGION_PLANS.length] as (typeof REGION_PLANS)[number];
  const rng = createRng(run.seed + index * 7919);
  const level = 1 + Math.floor(Math.max(0, companyLevel - 1) * 0.5) + index + (node.kind === 'elite' ? 1 : 0);
  const size = node.kind === 'boss' ? 3 : node.kind === 'elite' ? 6 : index < 2 ? 4 : 5;
  const enemies: StageEnemy[] = [];
  if (node.kind === 'boss') {
    enemies.push(e(plan.boss, 0, 1, level + 2));
    enemies.push(e(plan.pool[0] as string, 2, 0, level));
    enemies.push(e(plan.pool[2] as string, 2, 3, level));
  } else {
    for (const slot of SLOTS.slice(0, size)) {
      const enemyId = plan.pool[rng.int(plan.pool.length)] as string;
      enemies.push(e(enemyId, slot.row, slot.column, level));
    }
  }
  return {
    id: `rift-${run.seed}-${index}`,
    region: plan.id,
    index: index + 1,
    waves: [
      {
        enemies,
        ...(node.kind === 'elite' ? { elite: true } : {}),
        ...(node.kind === 'boss' ? { boss: true } : {}),
      },
    ],
    recommendedPower: 4800 + index * 900 + companyLevel * 100,
    ...(node.kind === 'boss' ? { rounds: 40 } : {}),
    firstClear: { gold: 0, essence: 0, shards: 0 },
    loot: { gold: 0, essence: 0, shardChance: 0 },
    ...(node.kind === 'elite' ? { elite: true } : {}),
    ...(node.kind === 'boss' ? { boss: true } : {}),
    modifiers: [`Dị Bản · ${node.label}`],
  };
}

/** Paid for every stop won; the boss pays shards. Repeating a rift is a farm, not a first-clear shortcut. */
export function riftNodeReward(
  index: number,
  boss = false,
): {
  gold: number;
  essence: number;
  shards: number;
} {
  return {
    gold: 70 + index * 30 + (boss ? 140 : 0),
    essence: 5 + index * 3,
    shards: boss ? 20 : index === 3 ? 6 : 0,
  };
}

/** The clear bonus after the sixth stop. */
export function riftClearBonus(): { gold: number; essence: number; shards: number } {
  return { gold: 250, essence: 30, shards: 30 };
}
