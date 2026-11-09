import { HEROES } from '../content/heroes.ts';
import { STAGES } from '../content/stages.ts';
import { cloneSave } from './progression.ts';
import type { SaveData } from './save-types.ts';
import type { Rarity, Rng } from './types.ts';

export const SUMMON_COST = 100;
export const TEN_PULL_COST = 900;
const OFFLINE_CAP_HOURS = 12;
const DUPLICATE_SHARDS: Record<Rarity, number> = { common: 10, rare: 20, epic: 40 };

export interface SummonResult {
  readonly heroId: string;
  readonly rarity: Rarity;
  readonly duplicate: boolean;
  readonly shards: number;
}

export interface SummonOutcome {
  readonly save: SaveData;
  readonly results: readonly SummonResult[];
}

/** A pull: earned shards only; visible pity; duplicates always become shards. */
export function summon(save: SaveData, rng: Rng, count: 1 | 10): SummonOutcome {
  const cost = count === 10 ? TEN_PULL_COST : SUMMON_COST;
  if (save.currencies.shards < cost) throw new Error(`summon: needs ${cost} shards`);
  const next = cloneSave(save);
  let shards = next.currencies.shards - cost;
  let pityRare = next.summon.pityRare;
  let pityEpic = next.summon.pityEpic;
  const roster = { ...next.roster };
  const results: SummonResult[] = [];

  for (let i = 0; i < count; i++) {
    pityRare++;
    pityEpic++;
    let rarity: Rarity;
    if (pityEpic >= 50) {
      rarity = 'epic';
      pityEpic = 0;
      pityRare = 0;
    } else if (pityRare >= 10) {
      rarity = rng.chance(0.15) ? 'epic' : 'rare';
      pityRare = 0;
    } else {
      const roll = rng.float();
      rarity = roll < 0.05 ? 'epic' : roll < 0.35 ? 'rare' : 'common';
    }
    const pool = HEROES.items.filter((hero) => hero.rarity === rarity);
    const hero = pool[rng.int(pool.length)] ?? HEROES.items[rng.int(HEROES.items.length)]!;
    const owned = roster[hero.id];
    if (owned) {
      const duplicate = DUPLICATE_SHARDS[rarity];
      shards += duplicate;
      roster[hero.id] = { ...owned, shards: owned.shards + duplicate };
      results.push({ heroId: hero.id, rarity, duplicate: true, shards: duplicate });
    } else {
      roster[hero.id] = { star: 1, shards: 0, gear: {} };
      results.push({ heroId: hero.id, rarity, duplicate: false, shards: 0 });
    }
  }

  return {
    save: {
      ...next,
      roster,
      currencies: { ...next.currencies, shards },
      summon: { ...next.summon, pityRare, pityEpic },
    },
    results,
  };
}

export interface OfflineReward {
  readonly hours: number;
  readonly gold: number;
  readonly essence: number;
  readonly shards: number;
}

/** What the company farmed while the app was closed: the highest cleared stage, capped at 12 h. */
export function offlineReward(save: SaveData, now: number): OfflineReward {
  const since = save.offline.at;
  if (!since || now <= since) return { hours: 0, gold: 0, essence: 0, shards: 0 };
  const hours = Math.min(OFFLINE_CAP_HOURS, (now - since) / 3_600_000);
  const stage = STAGES.items.find((candidate) => candidate.id === save.offline.stage) ?? STAGES.items[0]!;
  const rate = 1 + stage.index * 0.35;
  return {
    hours: Math.floor(hours * 10) / 10,
    gold: Math.floor(hours * 24 * rate),
    essence: Math.floor(hours * 2.4 * rate),
    shards: Math.floor(hours * 0.8),
  };
}

/** Add an offline reward once and start the next window. */
export function claimOffline(save: SaveData, now: number): { save: SaveData; reward: OfflineReward } {
  const reward = offlineReward(save, now);
  return {
    reward,
    save: {
      ...save,
      currencies: {
        gold: save.currencies.gold + reward.gold,
        essence: save.currencies.essence + reward.essence,
        shards: save.currencies.shards + reward.shards,
      },
      offline: { at: now, stage: save.offline.stage },
    },
  };
}
