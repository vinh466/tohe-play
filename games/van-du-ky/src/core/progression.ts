import { GEAR } from '../content/gear.ts';
import { HEROES } from '../content/heroes.ts';
import { regionNumber, STAGES } from '../content/stages.ts';
import type { SaveData, SaveFormation, SaveHero, SaveSlot } from './save-types.ts';
import { heroPower } from './stats.ts';
import type { HeroLoadout, Row, StageDef } from './types.ts';

const MAX_COMPANY = 20;
const STAR_COSTS = [0, 30, 60, 120, 240] as const;

export function cloneSave(save: SaveData): SaveData {
  return structuredClone(save);
}

/** XP needed to reach the next company level. */
export function xpToNext(level: number): number {
  return 100 + level * 80;
}

/** XP a stage pays: its region and index, plus a first-clear bonus. */
export function stageXp(stage: StageDef, first: boolean): number {
  return 100 + (regionNumber(stage.id) - 1) * 50 + stage.index * 10 + (first ? 50 : 0);
}

/** A cleared stage replay pays a little gold only: no essence, shards, gear, first-clear or XP. */
export function replayGold(stage: StageDef): number {
  return Math.max(4, Math.round(stage.loot.gold * 0.25));
}

/** Add XP and level the company; stops at 20. */
export function addCompanyXp(save: SaveData, xp: number): SaveData {
  const next = cloneSave(save);
  let level = next.company.level;
  const remaining = Math.max(0, Math.floor(xp));
  let current = next.company.xp + remaining;
  while (level < MAX_COMPANY && current >= xpToNext(level)) {
    current -= xpToNext(level);
    level++;
  }
  return { ...next, company: { level, xp: level >= MAX_COMPANY ? 0 : current } };
}

export function addCurrency(
  save: SaveData,
  delta: Partial<Record<keyof SaveData['currencies'], number>>,
): SaveData {
  const next = cloneSave(save);
  return {
    ...next,
    currencies: {
      gold: next.currencies.gold + Math.max(0, Math.floor(delta.gold ?? 0)),
      essence: next.currencies.essence + Math.max(0, Math.floor(delta.essence ?? 0)),
      shards: next.currencies.shards + Math.max(0, Math.floor(delta.shards ?? 0)),
    },
  };
}

export function starCost(star: number): number {
  return STAR_COSTS[Math.max(1, Math.min(5, star))] ?? 0;
}

export function starUp(save: SaveData, heroId: string): SaveData {
  const hero = save.roster[heroId];
  if (!hero) throw new Error(`starUp: ${heroId} is not in the roster`);
  if (hero.star >= 5) throw new Error(`starUp: ${heroId} is already ★5`);
  const cost = starCost(hero.star);
  if (save.currencies.essence < cost) throw new Error(`starUp: needs ${cost} essence`);
  const next = cloneSave(save);
  const target = next.roster[heroId] as SaveHero;
  return {
    ...next,
    currencies: { ...next.currencies, essence: next.currencies.essence - cost },
    roster: { ...next.roster, [heroId]: { ...target, star: target.star + 1 } },
  };
}

export function equipGear(save: SaveData, heroId: string, gearId: string): SaveData {
  const hero = save.roster[heroId];
  const piece = save.gear[gearId];
  if (!hero) throw new Error(`equip: ${heroId} is not in the roster`);
  if (!piece) throw new Error(`equip: ${gearId} is not in the inventory`);
  const def = GEAR.items.find((gear) => gear.id === piece.defId);
  if (!def) throw new Error(`equip: ${piece.defId} is not a gear definition`);
  const next = cloneSave(save);
  // A piece belongs to one hero: take it off whoever held it.
  for (const [id, other] of Object.entries(next.roster)) {
    if (other.gear[def.slot] === gearId) {
      const gear = { ...other.gear };
      delete gear[def.slot];
      next.roster[id] = { ...other, gear };
    }
  }
  const target = next.roster[heroId] as SaveHero;
  return {
    ...next,
    roster: { ...next.roster, [heroId]: { ...target, gear: { ...target.gear, [def.slot]: gearId } } },
  };
}

/** Take one slot off a hero; the piece goes back to the inventory. */
export function unequipGear(save: SaveData, heroId: string, slot: SaveSlot): SaveData {
  const hero = save.roster[heroId];
  if (!hero) throw new Error(`unequip: ${heroId} is not in the roster`);
  const next = cloneSave(save);
  const target = next.roster[heroId] as SaveHero;
  const gear = { ...target.gear };
  delete gear[slot];
  next.roster[heroId] = { ...target, gear };
  return next;
}

/** The gear pieces nobody is wearing, ready to equip. */
export function inventory(
  save: SaveData,
  slot?: 'weapon' | 'armor' | 'charm' | 'relic',
): { id: string; defId: string; plus: number }[] {
  const worn = new Set(
    Object.values(save.roster).flatMap((hero) =>
      Object.values(hero.gear).filter((id): id is string => typeof id === 'string'),
    ),
  );
  return Object.entries(save.gear)
    .filter(
      ([id, piece]) =>
        !worn.has(id) && (!slot || GEAR.items.some((def) => def.id === piece.defId && def.slot === slot)),
    )
    .map(([id, piece]) => ({ id, defId: piece.defId, plus: piece.plus }));
}

export function upgradeCost(piece: { readonly plus: number }): number {
  return 40 * (piece.plus + 1);
}

/** Something the player can pay for now: a star-up or a gear plus. A dot on Nâng cấp follows it. */
export function hasAffordableUpgrade(save: SaveData): boolean {
  for (const hero of Object.values(save.roster)) {
    if (hero.star < 5 && save.currencies.essence >= starCost(hero.star)) return true;
  }
  return Object.values(save.gear).some(
    (piece) => piece.plus < 5 && save.currencies.gold >= upgradeCost(piece),
  );
}

export function upgradeGear(save: SaveData, gearId: string): SaveData {
  const piece = save.gear[gearId];
  if (!piece) throw new Error(`upgrade: ${gearId} is not in the inventory`);
  if (piece.plus >= 5) throw new Error(`upgrade: ${gearId} is already +5`);
  const cost = upgradeCost(piece);
  if (save.currencies.gold < cost) throw new Error(`upgrade: needs ${cost} gold`);
  const next = cloneSave(save);
  return {
    ...next,
    currencies: { ...next.currencies, gold: next.currencies.gold - cost },
    gear: { ...next.gear, [gearId]: { ...piece, plus: piece.plus + 1 } },
    daily: { ...next.daily, upgrades: next.daily.upgrades + 1 },
  };
}

export function setFormation(save: SaveData, formation: readonly SaveFormation[]): SaveData {
  const seen = new Set<string>();
  const clean = formation.filter((entry) => {
    if (!save.roster[entry.heroId] || seen.has(entry.heroId)) return false;
    seen.add(entry.heroId);
    return true;
  });
  return { ...cloneSave(save), formation: clean.slice(0, 6) };
}

/** The six loadouts a battle uses, from the saved formation and roster. */
export function loadouts(save: SaveData): HeroLoadout[] {
  return save.formation
    .filter((entry) => save.roster[entry.heroId])
    .map((entry) => {
      const hero = save.roster[entry.heroId] as SaveHero;
      const gearIds = Object.values(hero.gear).filter((id): id is string => typeof id === 'string');
      return {
        heroId: entry.heroId,
        row: entry.row as Row,
        column: entry.column,
        star: hero.star,
        gear: gearIds,
        plus: gearIds.map((id) => save.gear[id]?.plus ?? 0),
      };
    });
}

export function teamPower(save: SaveData): number {
  const team = new Set(save.formation.map((entry) => entry.heroId));
  return save.formation.reduce((sum, entry) => {
    const hero = save.roster[entry.heroId];
    const def = HEROES.items.find((candidate) => candidate.id === entry.heroId);
    if (!hero || !def) return sum;
    const gearIds = Object.values(hero.gear).filter((id): id is string => typeof id === 'string');
    const gear = gearIds
      .map((id) => GEAR.items.find((piece) => piece.id === id))
      .filter((piece): piece is NonNullable<typeof piece> => piece !== undefined);
    const plus = gearIds.map((id) => save.gear[id]?.plus ?? 0);
    return (
      sum +
      heroPower(
        def,
        {
          companyLevel: save.company.level,
          star: hero.star,
          gear,
          plus,
          bond: team.has(def.bond),
        },
        entry.row,
      )
    );
  }, 0);
}

/** The order a stage sits in the road, for comparing two clears. */
export function stageOrder(stageId: string): number {
  return STAGES.items.findIndex((stage) => stage.id === stageId);
}

export function nextStage(stage: StageDef): StageDef | null {
  const index = STAGES.items.findIndex((candidate) => candidate.id === stage.id);
  return index >= 0 && index + 1 < STAGES.items.length ? (STAGES.items[index + 1] as StageDef) : null;
}

/** Apply a win: normal loot and XP on a first clear; only a little gold on a replay. A loss changes nothing. */
export function recordClear(save: SaveData, stage: StageDef, now = Date.now()): SaveData {
  const next = cloneSave(save);
  const first = !next.cleared.includes(stage.id);
  const gold = first ? stage.loot.gold + stage.firstClear.gold : replayGold(stage);
  const essence = first ? stage.loot.essence + stage.firstClear.essence : 0;
  const shards = first ? stage.firstClear.shards : 0;
  const current = `${next.progress.region}-${next.progress.stage}`;
  const advances = stageOrder(stage.id) >= stageOrder(current);
  const upcoming = advances ? nextStage(stage) : null;
  const highest = stageOrder(stage.id) > stageOrder(next.progress.highest) ? stage.id : next.progress.highest;
  const leveled = first ? addCompanyXp(next, stageXp(stage, first)) : next;
  return {
    ...leveled,
    currencies: {
      gold: leveled.currencies.gold + gold,
      essence: leveled.currencies.essence + essence,
      shards: leveled.currencies.shards + shards,
    },
    cleared: first ? [...leveled.cleared, stage.id] : leveled.cleared,
    progress: {
      ...leveled.progress,
      region: upcoming ? regionNumber(upcoming.id) : advances ? regionNumber(stage.id) : next.progress.region,
      stage: upcoming ? upcoming.index : advances ? stage.index : next.progress.stage,
      highest,
      records: { ...leveled.progress.records, bestStage: highest },
    },
    daily: { ...leveled.daily, stages: leveled.daily.stages + 1 },
    offline: { at: now, stage: highest },
  };
}

/** A new day: the three tasks and the counters reset; the journey keeps its place. */
export function resetDaily(save: SaveData, date: string): SaveData {
  if (save.daily.date === date) return save;
  return {
    ...cloneSave(save),
    daily: { ...save.daily, date, stages: 0, upgrades: 0, summons: 0, tasks: [], expedition: false },
  };
}

/** A new week: the boss and the challenge reset. */
export function resetWeekly(save: SaveData, week: string): SaveData {
  if (save.weekly.week === week) return save;
  return {
    ...cloneSave(save),
    weekly: {
      week,
      bossDamage: 0,
      bossClaimed: false,
      challengeRounds: 0,
      challengeClaimed: false,
    },
  };
}
