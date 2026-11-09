import { describe, expect, it } from 'vitest';
import { emptySave, fitsSaveBudget, migrate, SAVE_BUDGET_BYTES, SaveError, serializedBytes } from './save.ts';

describe('save', () => {
  it('starts with the six starters, a full formation and a clean budget', () => {
    const save = emptySave();
    expect(Object.keys(save.roster)).toHaveLength(6);
    expect(save.formation).toHaveLength(6);
    expect(save.company.level).toBe(1);
    expect(save.currencies).toEqual({ gold: 0, essence: 0, shards: 100 });
    expect(serializedBytes(save)).toBeLessThan(SAVE_BUDGET_BYTES);
    expect(fitsSaveBudget(save)).toBe(true);
  });

  it('round-trips through JSON', () => {
    const save = emptySave();
    expect(migrate(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it('migrates null to a fresh save and refuses an unknown version', () => {
    expect(migrate(null).v).toBe(1);
    expect(() => migrate({ v: 99 })).toThrow(SaveError);
    expect(() => migrate({ v: 0, roster: {} })).toThrow(SaveError);
  });

  it('normalizes out-of-range values instead of keeping a broken save', () => {
    const save = migrate({
      ...emptySave(),
      company: { level: 99, xp: -4 },
      currencies: { gold: -10, essence: 1.8, shards: Number.NaN },
      roster: { 've-binh': { star: 9, shards: -1, gear: { weapon: 'missing' } } },
    });
    expect(save.company.level).toBe(20);
    expect(save.company.xp).toBe(0);
    expect(save.currencies.gold).toBe(0);
    expect(save.currencies.essence).toBe(1);
    expect(save.currencies.shards).toBe(0);
    expect(save.roster['ve-binh']?.star).toBe(5);
    expect(save.roster['ve-binh']?.gear.weapon).toBeUndefined();
  });
});
