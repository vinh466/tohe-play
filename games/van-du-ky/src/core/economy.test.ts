import { describe, expect, it } from 'vitest';
import { HEROES } from '../content/heroes.ts';
import { claimOffline, offlineReward, SUMMON_COST, summon, TEN_PULL_COST } from './economy.ts';
import { createRng } from './rng.ts';
import { emptySave } from './save.ts';

function rich() {
  return { ...emptySave(), currencies: { gold: 0, essence: 0, shards: 10_000 } };
}

describe('summon', () => {
  it('charges the pull and always leaves a usable result', () => {
    const start = rich();
    const { save, results } = summon(start, createRng(7), 10);
    const gained = results.reduce((sum, result) => sum + result.shards, 0);
    expect(save.currencies.shards).toBe(start.currencies.shards - TEN_PULL_COST + gained);
    expect(results).toHaveLength(10);
    expect(results.every((result) => HEROES.items.some((hero) => hero.id === result.heroId))).toBe(true);
  });

  it('gives a Rare+ on the 10th pull without one', () => {
    const start = { ...rich(), summon: { pityRare: 9, pityEpic: 0, lastFree: null } };
    const { save, results } = summon(start, createRng(1), 1);
    expect(['rare', 'epic']).toContain(results[0]?.rarity);
    expect(save.summon.pityRare).toBe(0);
  });

  it('gives an Epic on the 50th pull without one', () => {
    const start = { ...rich(), summon: { pityRare: 0, pityEpic: 49, lastFree: null } };
    const { save, results } = summon(start, createRng(1), 1);
    expect(results[0]?.rarity).toBe('epic');
    expect(save.summon.pityEpic).toBe(0);
    expect(save.summon.pityRare).toBe(0);
  });

  it('turns a duplicate into shards and never loses a hero', () => {
    const start = rich();
    const roster = Object.fromEntries(
      HEROES.items.map((hero) => [hero.id, { star: 1, shards: 0, gear: {} }]),
    );
    const full = { ...start, roster };
    const before = full.currencies.shards;
    const { save, results } = summon(full, createRng(3), 1);
    expect(results[0]?.duplicate).toBe(true);
    expect(save.currencies.shards).toBe(before - SUMMON_COST + results[0]!.shards);
    expect(Object.keys(save.roster)).toHaveLength(HEROES.items.length);
  });

  it('refuses a pull without enough shards', () => {
    const broke = { ...emptySave(), currencies: { ...emptySave().currencies, shards: 0 } };
    expect(() => summon(broke, createRng(1), 1)).toThrow('needs');
  });
});

describe('offline', () => {
  it('caps at 12 h and never goes backwards', () => {
    const now = 1_000_000_000;
    const start = { ...emptySave(), offline: { at: now - 24 * 3_600_000, stage: '1-4' } };
    const reward = offlineReward(start, now);
    expect(reward.hours).toBe(12);
    expect(reward.gold).toBeGreaterThan(0);
    expect(offlineReward(start, start.offline.at - 1).hours).toBe(0);
    const claimed = claimOffline(start, now).save;
    expect(claimed.currencies.gold).toBe(reward.gold);
    expect(offlineReward(claimed, now).hours).toBe(0);
  });
});
