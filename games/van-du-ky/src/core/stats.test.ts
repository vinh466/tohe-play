import { describe, expect, it } from 'vitest';
import { GEAR } from '../content/gear.ts';
import { HEROES } from '../content/heroes.ts';
import { applyRow, elementMultiplier, gearStats, heroPower, heroStats, power } from './stats.ts';

const veBinh = HEROES.get('ve-binh');

describe('elements', () => {
  it('forms a four-element ring', () => {
    expect(elementMultiplier('ember', 'gale')).toBe(1.25);
    expect(elementMultiplier('tide', 'ember')).toBe(1.25);
    expect(elementMultiplier('stone', 'tide')).toBe(1.25);
    expect(elementMultiplier('gale', 'stone')).toBe(1.25);
    expect(elementMultiplier('ember', 'tide')).toBe(0.8);
    expect(elementMultiplier('ember', 'stone')).toBe(1);
  });
});

describe('rows', () => {
  it('makes the front tough, the mid quick and the back hard-hitting', () => {
    const base = { hp: 1000, atk: 100, def: 100, spd: 100, crit: 0.1 };
    const front = applyRow(base, 0);
    const mid = applyRow(base, 1);
    const back = applyRow(base, 2);
    expect(front.def).toBe(120);
    expect(front.hp).toBe(1100);
    expect(mid.spd).toBeCloseTo(105);
    expect(mid.atk).toBeCloseTo(110);
    expect(back.atk).toBeCloseTo(115);
    expect(back.def).toBe(100);
  });
});

describe('growth', () => {
  it('company level and stars multiply the base; gear adds after', () => {
    const at1 = heroStats(veBinh, { companyLevel: 1, star: 1 });
    const at10 = heroStats(veBinh, { companyLevel: 10, star: 3 });
    expect(at10.hp).toBeGreaterThan(at1.hp);
    expect(at10.atk).toBeGreaterThan(at1.atk);
    const geared = heroStats(veBinh, {
      companyLevel: 1,
      star: 1,
      gear: [GEAR.get('giap-da')],
    });
    expect(geared.hp).toBe(at1.hp + 140);
  });

  it('a 2-piece set gives its bonus and +1 gives 10% of the piece', () => {
    const one = gearStats([GEAR.get('kiem-lua')]);
    const two = gearStats([GEAR.get('kiem-lua'), GEAR.get('bua-lua')]);
    expect(two.atk).toBe(19); // the ember 2-piece adds 8% of the sword's ATK
    const plus = gearStats([GEAR.get('kiem-lua')], [1]);
    expect(plus.atk).toBe(one.atk + 2);
    const set = gearStats([GEAR.get('giap-da'), GEAR.get('di-vat-dat')]);
    expect(set.def).toBeGreaterThan(GEAR.get('di-vat-dat').value);
  });

  it('power rises with the company and the row', () => {
    const low = heroPower(veBinh, { companyLevel: 1, star: 1 }, 0);
    const high = heroPower(veBinh, { companyLevel: 10, star: 3 }, 0);
    expect(high).toBeGreaterThan(low);
    expect(power(heroStats(veBinh, { companyLevel: 1, star: 1 }))).toBeGreaterThan(0);
  });
});
