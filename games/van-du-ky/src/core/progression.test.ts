import { describe, expect, it } from 'vitest';
import { STAGES, stageById } from '../content/stages.ts';
import {
  addCompanyXp,
  addCurrency,
  equipGear,
  hasAffordableUpgrade,
  inventory,
  loadouts,
  recordClear,
  resetDaily,
  resetWeekly,
  setFormation,
  starCost,
  starUp,
  teamPower,
  upgradeGear,
  xpToNext,
} from './progression.ts';
import { emptySave } from './save.ts';

describe('company growth', () => {
  it('levels up at the XP curve and stops at 20', () => {
    const start = emptySave();
    const next = addCompanyXp(start, xpToNext(1));
    expect(next.company.level).toBe(2);
    expect(next.company.xp).toBe(0);
    const max = addCompanyXp(start, 10_000_000);
    expect(max.company.level).toBe(20);
  });

  it('adds currencies without going negative', () => {
    const next = addCurrency(emptySave(), { gold: 100, essence: 4, shards: -2 });
    expect(next.currencies).toEqual({ gold: 100, essence: 4, shards: 100 });
  });
});

describe('heroes and gear', () => {
  it('stars up with essence and refuses when short', () => {
    const base = emptySave();
    const save = { ...base, currencies: { ...base.currencies, essence: starCost(1) } };
    const up = starUp(save, 'moc-y');
    expect(up.roster['moc-y']?.star).toBe(2);
    expect(up.currencies.essence).toBe(0);
    expect(() => starUp(up, 'moc-y')).toThrow('essence');
  });

  it('a gear piece belongs to one hero and can move', () => {
    const save = emptySave();
    const moved = equipGear(save, 'moc-y', 'kiem-lua');
    expect(moved.roster['kiem-si']?.gear.weapon).toBeUndefined();
    expect(moved.roster['moc-y']?.gear.weapon).toBe('kiem-lua');
  });

  it('upgrades a piece to +5, spends gold and counts the daily task', () => {
    let save = addCurrency(emptySave(), { gold: 10_000 });
    for (let i = 0; i < 5; i++) save = upgradeGear(save, 'kiem-lua');
    expect(save.gear['kiem-lua']?.plus).toBe(5);
    expect(save.daily.upgrades).toBe(5);
    expect(() => upgradeGear(save, 'kiem-lua')).toThrow('+5');
  });

  it('lists the pieces nobody is wearing, by slot', () => {
    const save = {
      ...emptySave(),
      gear: {
        ...emptySave().gear,
        'di-vat-gio': { defId: 'di-vat-gio', plus: 1 },
      },
    };
    expect(inventory(save).map((piece) => piece.id)).toContain('di-vat-gio');
    expect(inventory(save, 'weapon').map((piece) => piece.id)).not.toContain('di-vat-gio');
  });

  it('turns the formation into six loadouts with gear plus levels', () => {
    const save = {
      ...emptySave(),
      gear: { ...emptySave().gear, 'kiem-lua': { defId: 'kiem-lua', plus: 3 } },
    };
    const team = loadouts(save);
    expect(team).toHaveLength(6);
    const kiem = team.find((hero) => hero.heroId === 'kiem-si');
    expect(kiem?.gear).toContain('kiem-lua');
    expect(kiem?.plus).toContain(3);
    expect(teamPower(save)).toBeGreaterThan(0);
  });

  it('keeps a six-slot formation, one hero per slot', () => {
    const save = emptySave();
    const next = setFormation(save, [
      { heroId: 've-binh', row: 0, column: 0 },
      { heroId: 've-binh', row: 0, column: 1 },
      { heroId: 'kiem-si', row: 1, column: 0 },
    ]);
    expect(next.formation).toEqual([
      { heroId: 've-binh', row: 0, column: 0 },
      { heroId: 'kiem-si', row: 1, column: 0 },
    ]);
  });
});

describe('stage clears', () => {
  it('pays the first clear once, grants XP and advances the stage', () => {
    const stage = stageById('1-1');
    const first = recordClear(emptySave(), stage, 1000);
    expect(first.cleared).toContain('1-1');
    expect(first.progress.highest).toBe('1-1');
    expect(first.progress.stage).toBe(2);
    expect(first.company.xp).toBeGreaterThan(0);
    expect(first.currencies.gold).toBe(stage.firstClear.gold + stage.loot.gold);
    const again = recordClear(first, stage, 2000);
    expect(again.currencies.gold).toBe(first.currencies.gold + stage.loot.gold);
    expect(again.cleared).toEqual(first.cleared);
    expect(again.daily.stages).toBe(2);
  });

  it('farming an old stage never lowers the highest stage or the region', () => {
    let save = recordClear(emptySave(), stageById('1-3'), 1000);
    save = recordClear(save, stageById('1-1'), 2000);
    expect(save.progress.highest).toBe('1-3');
    expect(save.progress.region).toBe(1);
    expect(save.progress.stage).toBe(4);
  });

  it('crossing into the next region tracks its number', () => {
    let save = emptySave();
    for (let i = 1; i <= 12; i++) save = recordClear(save, stageById(`${1}-${i}`), i);
    expect(save.progress.region).toBe(2);
    expect(save.progress.stage).toBe(1);
    expect(save.progress.highest).toBe('1-12');
  });
});

describe('resets', () => {
  it('a new day clears the counters and tasks but keeps the journey', () => {
    const save = {
      ...emptySave(),
      daily: {
        ...emptySave().daily,
        date: '2026-11-08',
        stages: 3,
        tasks: ['clear-3'],
        expedition: true,
        journeyDay: 4,
      },
    };
    const next = resetDaily(save, '2026-11-09');
    expect(next.daily.stages).toBe(0);
    expect(next.daily.tasks).toEqual([]);
    expect(next.daily.expedition).toBe(false);
    expect(next.daily.journeyDay).toBe(4);
    expect(resetDaily(next, '2026-11-09')).toBe(next);
  });

  it('a new week clears the boss and the challenge', () => {
    const save = {
      ...emptySave(),
      weekly: {
        week: '2026-11-02',
        bossDamage: 900,
        bossClaimed: true,
        challengeRounds: 4,
        challengeClaimed: true,
      },
    };
    const next = resetWeekly(save, '2026-11-09');
    expect(next.weekly).toEqual({
      week: '2026-11-09',
      bossDamage: 0,
      bossClaimed: false,
      challengeRounds: 0,
      challengeClaimed: false,
    });
  });
});

describe('affordable upgrades', () => {
  it('lights the upgrade dot for essence (stars) or gold (gear)', () => {
    const base = emptySave();
    expect(hasAffordableUpgrade(base)).toBe(false);
    const star = { ...base, currencies: { ...base.currencies, essence: starCost(1) } };
    expect(hasAffordableUpgrade(star)).toBe(true);
    const gear = { ...base, currencies: { ...base.currencies, gold: 40 } };
    expect(hasAffordableUpgrade(gear)).toBe(true);
  });
});
