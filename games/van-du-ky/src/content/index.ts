import { checkReferences } from '@tohe/game-kit';
import type { BattleRules } from '../core/battle.ts';
import type { EnemyDef, GearDef, HeroDef, HeroLoadout, SkillDef } from '../core/types.ts';
import { BONDS } from './bonds.ts';
import { ENEMIES } from './enemies.ts';
import { GEAR } from './gear.ts';
import { HEROES } from './heroes.ts';
import { SKILLS } from './skills.ts';
import { REGIONS, STAGES } from './stages.ts';

function lookup<T extends { id: string }>(items: readonly T[], kind: string, id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`${kind}: no item with id "${id}"`);
  return item;
}

/** The content the battle engine and the balance simulation read. */
export const RULES: BattleRules = {
  hero: (id): HeroDef => lookup(HEROES.items, 'hero', id),
  enemy: (id): EnemyDef => lookup(ENEMIES.items, 'enemy', id),
  skill: (id): SkillDef => lookup(SKILLS.items, 'skill', id),
  gear: (id): GearDef => lookup(GEAR.items, 'gear', id),
};

/** The company's opening team: two front, two mid, two back, spread over the four lanes. */
export const STARTER_TEAM: readonly HeroLoadout[] = [
  { heroId: 've-binh', row: 0, column: 1, star: 2, gear: [] },
  { heroId: 'kiem-si', row: 0, column: 2, star: 2, gear: ['kiem-lua'] },
  { heroId: 'troi-buoc', row: 1, column: 0, star: 1, gear: [] },
  { heroId: 'loi-vu', row: 1, column: 3, star: 1, gear: [] },
  { heroId: 'tien-tri', row: 2, column: 1, star: 2, gear: ['bua-nuoc'] },
  { heroId: 'moc-y', row: 2, column: 2, star: 1, gear: [] },
];

/** The bond whose two heroes are exactly this pair, in either order. */
export function bondOf(a: string, b: string): (typeof BONDS.items)[number] | undefined {
  return BONDS.items.find((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a));
}

/** Every reference the content makes must resolve; the game's tests fail on a problem. */
export function contentProblems(): string[] {
  const problems = checkReferences([
    { from: HEROES, field: 'basic', to: SKILLS, ids: (hero) => [hero.basic] },
    { from: HEROES, field: 'active', to: SKILLS, ids: (hero) => [hero.active] },
    { from: HEROES, field: 'bond', to: HEROES, ids: (hero) => [hero.bond] },
    { from: BONDS, field: 'a', to: HEROES, ids: (bond) => [bond.a] },
    { from: BONDS, field: 'b', to: HEROES, ids: (bond) => [bond.b] },
    { from: ENEMIES, field: 'basic', to: SKILLS, ids: (enemy) => [enemy.basic] },
    { from: ENEMIES, field: 'active', to: SKILLS, ids: (enemy) => [enemy.active] },
    {
      from: STAGES,
      field: 'wave.enemy',
      to: ENEMIES,
      ids: (stage) => stage.waves.flatMap((wave) => wave.enemies.map((enemy) => enemy.enemyId)),
    },
    {
      from: STAGES,
      field: 'loot.gear',
      to: GEAR,
      ids: (stage) => ('gear' in stage.loot && stage.loot.gear ? [stage.loot.gear] : []),
    },
    { from: STAGES, field: 'region', to: REGIONS, ids: (stage) => [stage.region] },
  ]).map((problem) => `${problem.kind}/${problem.id}: ${problem.field} → ${problem.missing}`);

  for (const stage of STAGES.items) {
    if (stage.waves.length === 0) problems.push(`${stage.id}: no waves`);
    for (const wave of stage.waves) {
      const slots = new Set<string>();
      for (const enemy of wave.enemies) {
        const key = `${enemy.row}:${enemy.column}`;
        if (slots.has(key)) problems.push(`${stage.id}: two enemies in ${key}`);
        slots.add(key);
      }
    }
  }

  // Bonds are pairs: mutual in the heroes, each hero in exactly one pair, no pair twice.
  const paired = new Set<string>();
  for (const bond of BONDS.items) {
    const a = HEROES.items.find((hero) => hero.id === bond.a);
    const b = HEROES.items.find((hero) => hero.id === bond.b);
    if (!a || !b) continue;
    if (a.bond !== bond.b) problems.push(`${bond.id}: ${a.id} bonds ${a.bond}, not ${bond.b}`);
    if (b.bond !== bond.a) problems.push(`${bond.id}: ${b.id} bonds ${b.bond}, not ${bond.a}`);
    for (const id of [bond.a, bond.b]) {
      if (paired.has(id)) problems.push(`${bond.id}: ${id} is in more than one bond`);
      paired.add(id);
    }
  }
  return problems;
}
