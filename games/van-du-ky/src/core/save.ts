import { GEAR } from '../content/gear.ts';
import { STARTER_TEAM } from '../content/index.ts';
import type { SaveData, SaveFormation, SaveGear, SaveHero } from './save-types.ts';

export * from './save-types.ts';

/** The save's schema version. A change that cannot be read by the old code bumps it and adds a migration. */
export const SAVE_VERSION = 1;

export class SaveError extends Error {}

const MAX_GEAR = 200;

/** A fresh company: the six starters, no progress, no currencies. */
export function emptySave(): SaveData {
  const roster: Record<string, SaveHero> = {};
  const gear: Record<string, SaveGear> = {};
  for (const hero of STARTER_TEAM) {
    roster[hero.heroId] = { star: hero.star, shards: 0, gear: {} };
    for (const id of hero.gear) {
      const def = GEAR.items.find((piece) => piece.id === id);
      if (!def) continue;
      gear[id] = { defId: def.id, plus: 0 };
      roster[hero.heroId]!.gear[def.slot] = id;
    }
  }
  return {
    v: SAVE_VERSION,
    company: { level: 1, xp: 0 },
    currencies: { gold: 0, essence: 0, shards: 100 },
    roster,
    gear,
    formation: STARTER_TEAM.map((hero) => ({ heroId: hero.heroId, row: hero.row, column: hero.column })),
    progress: {
      region: 1,
      stage: 1,
      highest: '1-1',
      tower: 1,
      records: { bestStage: '1-1', tower: 0, bossDamage: 0 },
    },
    cleared: [],
    daily: { date: '', tasks: [], expedition: false, boss: false, journeyDay: 1 },
    summon: { pityRare: 0, pityEpic: 0, lastFree: null },
    settings: { autoCast: true, speed: 2, reducedMotion: false },
    offline: { at: 0, stage: '1-1' },
    tutorial: { seen: false },
  };
}

/** Parse a save from the hub. Null/undefined is a first play; an unknown version is refused, never guessed. */
export function migrate(raw: unknown): SaveData {
  if (raw === null || raw === undefined) return emptySave();
  if (typeof raw !== 'object') throw new SaveError('save is not an object');
  const value = raw as Partial<SaveData> & { v?: unknown };
  if (value.v !== SAVE_VERSION) {
    throw new SaveError(
      `save version ${String(value.v)} is not supported (this build reads ${SAVE_VERSION})`,
    );
  }
  return normalize(value as SaveData);
}

/** Keep a save within the schema: numbers finite and non-negative, known slots, gear capped. */
export function normalize(input: SaveData): SaveData {
  const roster: Record<string, SaveHero> = {};
  for (const [id, hero] of Object.entries(input.roster ?? {})) {
    if (!hero || typeof hero !== 'object') continue;
    roster[id] = {
      star: clampInt(hero.star, 1, 5, 1),
      shards: clampInt(hero.shards, 0, 1_000_000, 0),
      gear: {
        weapon: typeof hero.gear?.weapon === 'string' ? hero.gear.weapon : undefined,
        armor: typeof hero.gear?.armor === 'string' ? hero.gear.armor : undefined,
        charm: typeof hero.gear?.charm === 'string' ? hero.gear.charm : undefined,
        relic: typeof hero.gear?.relic === 'string' ? hero.gear.relic : undefined,
      },
    };
  }
  const gear: Record<string, SaveGear> = {};
  for (const [id, piece] of Object.entries(input.gear ?? {}).slice(0, MAX_GEAR)) {
    if (!piece || typeof piece.defId !== 'string') continue;
    gear[id] = { defId: piece.defId, plus: clampInt(piece.plus, 0, 5, 0) };
  }
  for (const hero of Object.values(roster)) {
    for (const [slot, id] of Object.entries(hero.gear)) {
      if (typeof id === 'string' && !gear[id]) delete hero.gear[slot as keyof SaveHero['gear']];
    }
  }
  const formation = Array.isArray(input.formation)
    ? input.formation
        .filter(
          (entry): entry is SaveFormation =>
            !!entry &&
            typeof entry.heroId === 'string' &&
            (entry.row === 0 || entry.row === 1 || entry.row === 2) &&
            (entry.column === 0 || entry.column === 1),
        )
        .slice(0, 6)
    : [];
  const uniqueFormation = [...new Map(formation.map((entry) => [entry.heroId, entry])).values()];
  const effectiveFormation =
    uniqueFormation.length > 0
      ? uniqueFormation
      : STARTER_TEAM.map((hero) => ({ heroId: hero.heroId, row: hero.row, column: hero.column }));
  const progress = input.progress ?? { region: 1, stage: 1, highest: '1-1', tower: 1, records: {} };
  return {
    v: SAVE_VERSION,
    company: {
      level: clampInt(input.company?.level, 1, 20, 1),
      xp: clampInt(input.company?.xp, 0, Number.MAX_SAFE_INTEGER, 0),
    },
    currencies: {
      gold: clampInt(input.currencies?.gold, 0, Number.MAX_SAFE_INTEGER, 0),
      essence: clampInt(input.currencies?.essence, 0, Number.MAX_SAFE_INTEGER, 0),
      shards: clampInt(input.currencies?.shards, 0, Number.MAX_SAFE_INTEGER, 0),
    },
    roster,
    gear,
    formation: effectiveFormation,
    progress: {
      region: clampInt(progress.region, 1, 4, 1),
      stage: clampInt(progress.stage, 1, 12, 1),
      highest: typeof progress.highest === 'string' ? progress.highest : '1-1',
      tower: clampInt(progress.tower, 1, 10_000, 1),
      records: {
        bestStage: typeof progress.records?.bestStage === 'string' ? progress.records.bestStage : '1-1',
        tower: clampInt(progress.records?.tower, 0, 10_000, 0),
        bossDamage: clampInt(progress.records?.bossDamage, 0, Number.MAX_SAFE_INTEGER, 0),
      },
    },
    cleared: Array.isArray(input.cleared)
      ? [...new Set(input.cleared.filter((id): id is string => typeof id === 'string'))].slice(0, 100)
      : [],
    daily: {
      date: typeof input.daily?.date === 'string' ? input.daily.date : '',
      tasks: Array.isArray(input.daily?.tasks)
        ? [...new Set(input.daily.tasks.filter((task): task is string => typeof task === 'string'))].slice(
            0,
            3,
          )
        : [],
      expedition: input.daily?.expedition === true,
      boss: input.daily?.boss === true,
      journeyDay: clampInt(input.daily?.journeyDay, 1, 7, 1),
    },
    summon: {
      pityRare: clampInt(input.summon?.pityRare, 0, 10, 0),
      pityEpic: clampInt(input.summon?.pityEpic, 0, 50, 0),
      lastFree: typeof input.summon?.lastFree === 'string' ? input.summon.lastFree : null,
    },
    settings: {
      autoCast: input.settings?.autoCast !== false,
      speed: input.settings?.speed === 1 ? 1 : input.settings?.speed === 3 ? 3 : 2,
      reducedMotion: input.settings?.reducedMotion === true,
    },
    offline: {
      at: clampInt(input.offline?.at, 0, Number.MAX_SAFE_INTEGER, 0),
      stage: typeof input.offline?.stage === 'string' ? input.offline.stage : '1-1',
    },
    tutorial: { seen: input.tutorial?.seen === true },
  };
}

export function serializedBytes(save: SaveData): number {
  return new TextEncoder().encode(JSON.stringify(save)).byteLength;
}

/** The game declares 256 KB in game.json; the code uses this for a local guard before asking the hub. */
export const SAVE_BUDGET_BYTES = 256 * 1024;

export function fitsSaveBudget(save: SaveData): boolean {
  return serializedBytes(save) <= SAVE_BUDGET_BYTES;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
