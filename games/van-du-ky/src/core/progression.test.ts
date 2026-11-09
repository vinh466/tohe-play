import { describe, expect, it } from 'vitest';
import { STAGES } from '../content/stages.ts';
import {
  addCompanyXp,
  addCurrency,
  equipGear,
  loadouts,
  recordClear,
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
  it('stars up with shards and refuses when short', () => {
    const base = emptySave();
    const save = { ...base, currencies: { ...base.currencies, shards: starCost(1) } };
    const up = starUp(save, 'moc-y');
    expect(up.roster['moc-y']?.star).toBe(2);
    expect(up.currencies.shards).toBe(0);
    expect(() => starUp(up, 'moc-y')).toThrow('shards');
  });

  it('a gear piece belongs to one hero and can move', () => {
    const save = emptySave();
    const moved = equipGear(save, 'moc-y', 'kiem-lua');
    expect(moved.roster['kiem-si']?.gear.weapon).toBeUndefined();
    expect(moved.roster['moc-y']?.gear.weapon).toBe('kiem-lua');
  });

  it('upgrades a piece to +5 and spends gold', () => {
    let save = addCurrency(emptySave(), { gold: 10_000 });
    for (let i = 0; i < 5; i++) save = upgradeGear(save, 'kiem-lua');
    expect(save.gear['kiem-lua']?.plus).toBe(5);
    expect(() => upgradeGear(save, 'kiem-lua')).toThrow('+5');
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
  it('pays the first clear once and advances the stage', () => {
    const stage = STAGES.get('1-1');
    const first = recordClear(emptySave(), stage, 1000);
    expect(first.cleared).toContain('1-1');
    expect(first.progress.highest).toBe('1-1');
    expect(first.progress.stage).toBe(2);
    expect(first.currencies.gold).toBe(stage.firstClear.gold + stage.loot.gold);
    const again = recordClear(first, stage, 2000);
    expect(again.currencies.gold).toBe(first.currencies.gold + stage.loot.gold);
    expect(again.cleared).toEqual(first.cleared);
  });
});
