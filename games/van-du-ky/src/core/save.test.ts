import { describe, expect, it } from 'vitest';
import { emptySave, fitsSaveBudget, migrate, SAVE_BUDGET_BYTES, SaveError, serializedBytes } from './save.ts';

describe('save', () => {
  it('starts with the six starters, a full formation and a clean budget', () => {
    const save = emptySave();
    expect(Object.keys(save.roster)).toHaveLength(6);
    expect(save.formation).toHaveLength(6);
    expect(save.company.level).toBe(1);
    expect(save.currencies).toEqual({ gold: 0, essence: 0, shards: 100 });
    expect(save.daily.stages).toBe(0);
    expect(save.weekly.bossClaimed).toBe(false);
    expect(serializedBytes(save)).toBeLessThan(SAVE_BUDGET_BYTES);
    expect(fitsSaveBudget(save)).toBe(true);
  });

  it('round-trips through JSON', () => {
    const save = emptySave();
    expect(migrate(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it('migrates a v1 save and refuses an unknown version', () => {
    const v1 = {
      v: 1,
      company: { level: 3, xp: 10 },
      currencies: { gold: 50, essence: 2, shards: 9 },
      roster: { 've-binh': { star: 2, shards: 1, gear: {} } },
      gear: {},
      progress: { region: 1, stage: 4, highest: '1-3', tower: 2, records: {} },
      cleared: ['1-1', '1-2', '1-3'],
      daily: { date: '2026-11-08', tasks: [], expedition: false, boss: false, journeyDay: 2 },
      summon: { pityRare: 1, pityEpic: 2, lastFree: null },
      settings: { autoCast: true, speed: 2, reducedMotion: false },
      offline: { at: 1, stage: '1-3' },
      tutorial: { seen: true },
    };
    const save = migrate(v1);
    expect(save.v).toBe(2);
    expect(save.company.level).toBe(3);
    expect(save.daily.stages).toBe(0);
    expect(save.daily.journeyDay).toBe(2);
    expect(save.weekly.week).toBe('');
    expect(save.progress.records.bestStage).toBe('1-1');
    expect(() => migrate({ v: 99 })).toThrow(SaveError);
  });

  it('keeps the new fourth lane and drops an out-of-range column', () => {
    const four = migrate({
      ...emptySave(),
      formation: [{ heroId: 've-binh', row: 0, column: 3 }],
    });
    expect(four.formation).toEqual([{ heroId: 've-binh', row: 0, column: 3 }]);
    const bad = migrate({
      ...emptySave(),
      formation: [{ heroId: 've-binh', row: 0, column: 4 }],
    });
    expect(bad.formation.length).toBe(6);
  });

  it('normalizes out-of-range values instead of keeping a broken save', () => {
    const save = migrate({
      ...emptySave(),
      company: { level: 99, xp: -4 },
      currencies: { gold: -10, essence: 1.8, shards: Number.NaN },
      roster: { 've-binh': { star: 9, shards: -1, gear: { weapon: 'missing' } } },
      daily: { ...emptySave().daily, stages: -2, tasks: ['clear-3', 'clear-3'] },
    });
    expect(save.company.level).toBe(20);
    expect(save.company.xp).toBe(0);
    expect(save.currencies.gold).toBe(0);
    expect(save.currencies.essence).toBe(1);
    expect(save.currencies.shards).toBe(0);
    expect(save.roster['ve-binh']?.star).toBe(5);
    expect(save.roster['ve-binh']?.gear.weapon).toBeUndefined();
    expect(save.daily.stages).toBe(0);
    expect(save.daily.tasks).toEqual(['clear-3']);
  });
});
