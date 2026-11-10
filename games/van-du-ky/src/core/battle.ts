// The pure battle engine. It knows nothing of Phaser, the DOM, the hub or the wall clock: the view, the balance
// simulation and the tests call the same functions, so a seed and a team always produce the same battle.

import { createRng } from './rng.ts';
import { applyRow, elementMultiplier, enemyStats, heroStats } from './stats.ts';
import { applyTerrain, terrainAt } from './terrain.ts';
import type {
  BattleEnemyLoadout,
  BattleEvent,
  BattleState,
  BattleUnit,
  EnemyDef,
  GearDef,
  HeroDef,
  HeroLoadout,
  PendingTurn,
  SkillDef,
  StageDef,
  Stats,
} from './types.ts';

/** What the battle needs from the content: four lookups, no globals. */
export interface BattleRules {
  hero(id: string): HeroDef;
  enemy(id: string): EnemyDef;
  skill(id: string): SkillDef;
  gear(id: string): GearDef;
}

export interface BattleConfig {
  readonly seed: number;
  readonly companyLevel: number;
  readonly heroes: readonly HeroLoadout[];
  readonly enemies: readonly BattleEnemyLoadout[];
  readonly autoCast?: boolean;
  readonly maxRounds?: number;
}

const MAX_HEROES = 6;
const MAX_ENEMIES = 6;
const DEFAULT_MAX_ROUNDS = 30;

export function createBattle(rules: BattleRules, config: BattleConfig): BattleState {
  if (config.heroes.length < 1 || config.heroes.length > MAX_HEROES)
    throw new Error(`a battle needs 1–${MAX_HEROES} heroes`);
  if (config.enemies.length < 1 || config.enemies.length > MAX_ENEMIES)
    throw new Error(`a battle needs 1–${MAX_ENEMIES} enemies`);

  const units: BattleUnit[] = [];
  const heroIds = new Set(config.heroes.map((hero) => hero.heroId));
  config.heroes.forEach((loadout, index) => {
    const def = rules.hero(loadout.heroId);
    const stats = applyTerrain(
      applyRow(
        heroStats(def, {
          companyLevel: config.companyLevel,
          star: loadout.star,
          gear: loadout.gear.map((id) => rules.gear(id)),
          plus: loadout.plus,
          bond: heroIds.has(def.bond),
        }),
        loadout.row,
      ),
      terrainAt('hero', loadout.row, loadout.column),
    );
    const hp = Math.max(0, Math.min(stats.hp, loadout.hp ?? stats.hp));
    units.push({
      id: `h${index + 1}`,
      side: 'hero',
      defId: def.id,
      name: def.name,
      role: def.role,
      element: def.element,
      row: loadout.row,
      column: loadout.column,
      base: stats,
      hp,
      maxHp: stats.hp,
      shield: 0,
      charge: 0,
      activeCharge: rules.skill(def.active).charge,
      basic: def.basic,
      active: def.active,
      immuneControl: false,
      statuses: [],
      dead: hp <= 0,
    });
  });
  config.enemies.forEach((loadout, index) => {
    const def = rules.enemy(loadout.enemyId);
    const stats = applyTerrain(
      applyRow(enemyStats(def.base, loadout.level, def.boss), loadout.row),
      terrainAt('enemy', loadout.row, loadout.column),
    );
    units.push({
      id: `e${index + 1}`,
      side: 'enemy',
      defId: def.id,
      name: def.name,
      role: def.role,
      element: def.element,
      row: loadout.row,
      column: loadout.column,
      base: stats,
      hp: stats.hp,
      maxHp: stats.hp,
      shield: 0,
      charge: 0,
      activeCharge: rules.skill(def.active).charge,
      basic: def.basic,
      active: def.active,
      immuneControl: def.immuneControl ?? false,
      statuses: [],
      dead: false,
    });
  });

  const state: BattleState = {
    seed: config.seed,
    rng: createRng(config.seed),
    round: 1,
    maxRounds: config.maxRounds ?? DEFAULT_MAX_ROUNDS,
    order: turnOrder(units),
    turn: 0,
    units,
    pending: null,
    autoCast: config.autoCast ?? true,
    result: 'ongoing',
    events: [{ type: 'round', round: 1 }],
  };
  checkResult(state);
  return state;
}

/** SPD desc, then heroes before enemies, then row, column and id: stable and deterministic. */
export function turnOrder(units: readonly BattleUnit[]): string[] {
  return units
    .filter((unit) => !unit.dead)
    .slice()
    .sort(
      (a, b) =>
        b.base.spd - a.base.spd ||
        (a.side === b.side ? 0 : a.side === 'hero' ? -1 : 1) ||
        a.row - b.row ||
        a.column - b.column ||
        a.id.localeCompare(b.id),
    )
    .map((unit) => unit.id);
}

/** One step: an actor acts, a manual hero waits, or the round ends. */
export function step(state: BattleState, rules: BattleRules): PendingTurn | null {
  if (state.result !== 'ongoing') return null;
  if (state.pending) return state.pending;

  while (state.turn < state.order.length) {
    const actor = unitById(state, state.order[state.turn] as string);
    if (!actor || actor.dead) {
      state.turn++;
      continue;
    }
    if (actor.statuses.some((status) => status.kind === 'stun' && status.remaining > 0)) {
      state.events.push({ type: 'status', source: actor.id, target: actor.id, status: 'stun-skip' });
      state.turn++;
      continue;
    }
    if (actor.side === 'hero' && !state.autoCast) {
      state.pending = { unitId: actor.id, activeReady: activeReady(actor) };
      return state.pending;
    }
    autoAct(state, rules, actor);
    return null;
  }

  endRound(state);
  return null;
}

/** Step until the battle ends or a manual hero turn waits for a choice. */
export function runBattle(state: BattleState, rules: BattleRules, maxSteps = 10_000): BattleState {
  let steps = 0;
  while (state.result === 'ongoing' && !state.pending && steps++ < maxSteps) step(state, rules);
  return state;
}

/** A manual hero turn: cast the active (or a basic) on a target. Clears the pending turn and advances. */
export function cast(
  state: BattleState,
  rules: BattleRules,
  unitId: string,
  skillId: string,
  targetId?: string,
): BattleEvent[] {
  if (!state.pending || state.pending.unitId !== unitId)
    throw new Error(`cast: ${unitId} is not the pending hero`);
  const actor = unitById(state, unitId);
  if (!actor || actor.dead) throw new Error(`cast: ${unitId} is not alive`);
  const skill = rules.skill(skillId);
  if (skill.kind === 'active' && !activeReady(actor)) throw new Error(`cast: ${skillId} is not charged`);
  const before = state.events.length;
  resolveSkill(state, actor, skill, targetId);
  if (skill.kind === 'active') actor.charge = 0;
  else actor.charge = Math.min(actor.activeCharge, actor.charge + 1);
  state.pending = null;
  state.turn++;
  checkResult(state);
  return state.events.slice(before);
}

/** A manual hero turn's basic attack: the default when the player taps the card. */
export function basicAttack(
  state: BattleState,
  rules: BattleRules,
  unitId: string,
  targetId?: string,
): BattleEvent[] {
  const actor = unitById(state, unitId);
  if (!actor) throw new Error(`basic: ${unitId} is not in the battle`);
  return cast(state, rules, unitId, actor.basic, targetId);
}

function autoAct(state: BattleState, rules: BattleRules, actor: BattleUnit) {
  const active = rules.skill(actor.active);
  const skill = activeReady(actor) ? active : rules.skill(actor.basic);
  resolveSkill(state, actor, skill);
  if (skill.kind === 'active') actor.charge = 0;
  else actor.charge = Math.min(actor.activeCharge, actor.charge + 1);
  state.turn++;
  checkResult(state);
}

function resolveSkill(state: BattleState, source: BattleUnit, skill: SkillDef, targetId?: string) {
  const targets = chooseTargets(state, source, skill, targetId);
  state.events.push({ type: 'turn', unit: source.id, skill: skill.id });
  for (const target of targets) {
    switch (skill.effect) {
      case 'damage': {
        const hit = damage(state, source, target, skill);
        state.events.push({
          type: 'damage',
          source: source.id,
          target: target.id,
          amount: hit.amount,
          crit: hit.crit,
          element: hit.element,
        });
        if (target.hp <= 0 && !target.dead) {
          target.dead = true;
          state.events.push({ type: 'death', unit: target.id });
        }
        break;
      }
      case 'heal': {
        const amount = Math.round(effective(source).atk * skill.power);
        target.hp = Math.min(target.maxHp, target.hp + amount);
        state.events.push({ type: 'heal', source: source.id, target: target.id, amount });
        break;
      }
      case 'shield': {
        const amount = Math.round(source.maxHp * (skill.value ?? 0.15));
        target.shield += amount;
        state.events.push({ type: 'shield', source: source.id, target: target.id, amount });
        break;
      }
      case 'stun': {
        if (target.immuneControl) break;
        target.statuses.push({ kind: 'stun', value: 0, remaining: skill.duration ?? 1 });
        state.events.push({ type: 'status', source: source.id, target: target.id, status: 'stun' });
        break;
      }
      case 'buff-atk':
      case 'buff-def':
      case 'buff-spd': {
        target.statuses.push({
          kind: skill.effect,
          value: skill.value ?? 0.15,
          remaining: skill.duration ?? 2,
        });
        state.events.push({ type: 'status', source: source.id, target: target.id, status: skill.effect });
        break;
      }
      case 'burn': {
        target.statuses.push({
          kind: 'burn',
          value: Math.round(effective(source).atk * (skill.value ?? 0.3)),
          remaining: skill.duration ?? 2,
        });
        state.events.push({ type: 'status', source: source.id, target: target.id, status: 'burn' });
        break;
      }
    }
  }
  checkResult(state);
}

function damage(
  state: BattleState,
  source: BattleUnit,
  target: BattleUnit,
  skill: SkillDef,
): { amount: number; crit: boolean; element: number } {
  const attack = effective(source);
  const defence = effective(target);
  const crit = state.rng.chance(attack.crit);
  const element = elementMultiplier(skill.element ?? source.element, target.element);
  const raw = attack.atk * skill.power * element * (crit ? 1.5 : 1);
  let amount = Math.max(1, Math.round((raw * 100) / (100 + defence.def)));
  const absorbed = Math.min(target.shield, amount);
  target.shield -= absorbed;
  amount -= absorbed;
  target.hp = Math.max(0, target.hp - amount);
  return { amount, crit, element };
}

function chooseTargets(
  state: BattleState,
  source: BattleUnit,
  skill: SkillDef,
  targetId?: string,
): BattleUnit[] {
  const allies = state.units.filter((unit) => unit.side === source.side && !unit.dead);
  const enemies = state.units.filter((unit) => unit.side !== source.side && !unit.dead);
  if (targetId) {
    const chosen = unitById(state, targetId);
    if (chosen && !chosen.dead && chosen.side !== source.side) return [chosen];
  }
  switch (skill.target) {
    case 'enemy-all':
      return enemies;
    case 'ally-all':
      return allies;
    case 'self':
      return [source];
    case 'ally-lowest':
      return [lowest(allies)];
    case 'enemy-front': {
      const row = enemies.filter((unit) => unit.row === 0);
      return [lowest(row.length > 0 ? row : enemies)];
    }
    case 'enemy-back': {
      const row = enemies.filter((unit) => unit.row === 2);
      return [lowest(row.length > 0 ? row : enemies)];
    }
    default:
      return [lowest(enemies)];
  }
}

function lowest(units: readonly BattleUnit[]): BattleUnit {
  return units.reduce((low, unit) => (unit.hp / unit.maxHp < low.hp / low.maxHp ? unit : low));
}

function endRound(state: BattleState) {
  for (const unit of state.units) {
    if (unit.dead) continue;
    for (const status of unit.statuses) {
      if (status.kind === 'burn' && status.remaining > 0) {
        const amount = Math.min(unit.hp, Math.max(0, status.value));
        unit.hp -= amount;
        state.events.push({
          type: 'damage',
          source: unit.id,
          target: unit.id,
          amount,
          crit: false,
          element: 1,
        });
        if (unit.hp <= 0) {
          unit.dead = true;
          state.events.push({ type: 'death', unit: unit.id });
        }
      }
    }
    unit.statuses.splice(
      0,
      unit.statuses.length,
      ...unit.statuses
        .map((status) => ({ ...status, remaining: status.remaining - 1 }))
        .filter((status) => status.remaining > 0),
    );
  }
  checkResult(state);
  if (state.result !== 'ongoing') return;
  state.round++;
  if (state.round > state.maxRounds) {
    state.result = 'lose';
    return;
  }
  state.order = turnOrder(state.units);
  state.turn = 0;
  state.events.push({ type: 'round', round: state.round });
}

function checkResult(state: BattleState) {
  if (state.result !== 'ongoing') return;
  const heroes = state.units.some((unit) => unit.side === 'hero' && !unit.dead);
  const enemies = state.units.some((unit) => unit.side === 'enemy' && !unit.dead);
  if (!enemies) state.result = 'win';
  else if (!heroes) state.result = 'lose';
}

function effective(unit: BattleUnit): Stats {
  let atk = unit.base.atk;
  let def = unit.base.def;
  let spd = unit.base.spd;
  for (const status of unit.statuses) {
    if (status.kind === 'buff-atk') atk += unit.base.atk * status.value;
    if (status.kind === 'buff-def') def += unit.base.def * status.value;
    if (status.kind === 'buff-spd') spd += unit.base.spd * status.value;
  }
  return { hp: unit.maxHp, atk, def, spd, crit: unit.base.crit };
}

function activeReady(unit: BattleUnit): boolean {
  return unit.charge >= unit.activeCharge;
}

function unitById(state: BattleState, id: string): BattleUnit | undefined {
  return state.units.find((unit) => unit.id === id);
}

/** Run a whole stage, carrying HP between waves (living heroes heal 15%; dead stay dead). */
export interface StageOutcome {
  readonly won: boolean;
  readonly waves: number;
  readonly heroes: readonly { id: string; hp: number; maxHp: number; dead: boolean }[];
  readonly events: readonly BattleEvent[];
}

export function runStage(
  rules: BattleRules,
  stage: StageDef,
  heroes: readonly HeroLoadout[],
  companyLevel: number,
  seed: number,
): StageOutcome {
  let current = heroes.map((hero) => ({ ...hero }));
  const events: BattleEvent[] = [];
  let last: BattleState | null = null;
  let wave = 0;
  for (const definition of stage.waves) {
    wave++;
    const state = createBattle(rules, {
      seed: seed + wave * 7919,
      companyLevel,
      heroes: current,
      enemies: definition.enemies,
      autoCast: true,
      maxRounds: stage.rounds,
    });
    runBattle(state, rules);
    events.push(...state.events);
    last = state;
    if (state.result !== 'win') break;
    current = state.units
      .filter((unit) => unit.side === 'hero')
      .map((unit, index) => ({
        ...heroes[index]!,
        hp: unit.dead ? 0 : Math.min(unit.maxHp, unit.hp + Math.round(unit.maxHp * 0.15)),
      }));
  }
  const won = last?.result === 'win';
  return {
    won,
    waves: wave,
    heroes: last
      ? last.units
          .filter((unit) => unit.side === 'hero')
          .map((unit) => ({ id: unit.id, hp: unit.hp, maxHp: unit.maxHp, dead: unit.dead }))
      : [],
    events,
  };
}
