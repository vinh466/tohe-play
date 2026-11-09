import type { Element, GearDef, HeroDef, Row, Stats } from './types.ts';

/** The four elements form a ring: Ember > Gale > Stone > Tide > Ember. */
const STRONG: Record<Element, Element> = {
  ember: 'gale',
  gale: 'stone',
  stone: 'tide',
  tide: 'ember',
};

export function elementMultiplier(attacker: Element, defender: Element): number {
  if (STRONG[attacker] === defender) return 1.25;
  if (STRONG[defender] === attacker) return 0.8;
  return 1;
}

/** The row's baked-in bonus: front is tough, mid is quick, back hits harder. */
export function applyRow(stats: Stats, row: Row): Stats {
  const hp = Math.round(stats.hp * (row === 0 ? 1.1 : 1));
  const atk = stats.atk * (row === 1 ? 1.1 : row === 2 ? 1.15 : 1);
  const def = stats.def * (row === 0 ? 1.2 : 1);
  const spd = stats.spd * (row === 1 ? 1.05 : 1);
  return { hp, atk, def, spd, crit: stats.crit };
}

/** A 2-piece set gives one small bonus; the set is the gear's `set` id. */
export const SET_BONUSES: Record<string, { stat: keyof Stats; value: number }> = {
  ember: { stat: 'atk', value: 0.08 },
  tide: { stat: 'hp', value: 0.08 },
  stone: { stat: 'def', value: 0.1 },
  gale: { stat: 'spd', value: 0.06 },
};

/** Every gear piece adds its main stat (×1 + 10% per `plus`); every 2 pieces of one set add the set bonus. */
export function gearStats(gear: readonly GearDef[], plus: readonly number[] = []): Stats {
  const stats: Stats = { hp: 0, atk: 0, def: 0, spd: 0, crit: 0 };
  const counts = new Map<string, number>();
  gear.forEach((piece, index) => {
    const scale = 1 + (plus[index] ?? 0) * 0.1;
    (stats as Record<keyof Stats, number>)[piece.stat] += piece.value * scale;
    counts.set(piece.set, (counts.get(piece.set) ?? 0) + 1);
  });
  for (const [set, count] of counts) {
    const bonus = SET_BONUSES[set];
    if (!bonus || count < 2) continue;
    const base = stats[bonus.stat];
    (stats as Record<keyof Stats, number>)[bonus.stat] += base * bonus.value;
  }
  return {
    hp: Math.round(stats.hp),
    atk: Math.round(stats.atk),
    def: Math.round(stats.def),
    spd: Math.round(stats.spd),
    crit: stats.crit,
  };
}

export interface HeroGrowth {
  readonly companyLevel: number;
  readonly star: number;
  readonly gear?: readonly GearDef[];
  readonly plus?: readonly number[];
  /** A bond partner is deployed: +6% HP and ATK. */
  readonly bond?: boolean;
}

/** A hero's stats before the row bonus: base × company × stars + gear + the passive at its star. */
export function heroStats(def: HeroDef, growth: HeroGrowth): Stats {
  const level = Math.max(1, Math.min(20, growth.companyLevel));
  const star = Math.max(1, Math.min(5, growth.star));
  const company = 1 + (level - 1) * 0.09;
  const stars = 1 + (star - 1) * 0.18;
  const gear = gearStats(growth.gear ?? [], growth.plus ?? []);
  const stats: Stats = {
    hp: Math.round(def.base.hp * company * stars) + gear.hp,
    atk: Math.round(def.base.atk * company * stars) + gear.atk,
    def: Math.round(def.base.def * company * stars) + gear.def,
    spd: Math.round(def.base.spd * company * stars) + gear.spd,
    crit: Math.min(1, def.base.crit + gear.crit),
  };
  if (star >= def.passive.star) {
    (stats as Record<keyof Stats, number>)[def.passive.stat] +=
      (stats as Record<keyof Stats, number>)[def.passive.stat] * def.passive.value;
  }
  if (!growth.bond) return stats;
  return {
    ...stats,
    hp: Math.round(stats.hp * 1.06),
    atk: Math.round(stats.atk * 1.06),
  };
}

/** Enemy stats at a stage level: base × level; a boss is 1.35×. */
export function enemyStats(base: Stats, level: number, boss = false): Stats {
  const scale = (1 + Math.max(0, level - 1) * 0.1) * (boss ? 1.25 : 1);
  return {
    hp: Math.round(base.hp * scale),
    atk: Math.round(base.atk * scale),
    def: Math.round(base.def * scale),
    spd: Math.round(base.spd * scale),
    crit: base.crit,
  };
}

/** A single number for the stage preview; tuned by the simulation. */
export function power(stats: Stats): number {
  return Math.round(stats.hp * 0.12 + stats.atk * 2.4 + stats.def * 1.8 + stats.spd * 3.2 + stats.crit * 400);
}

/** A hero's power with the row bonus, for the formation/team summary. */
export function heroPower(def: HeroDef, growth: HeroGrowth, row: Row): number {
  return power(applyRow(heroStats(def, growth), row));
}
